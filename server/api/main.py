from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import FileResponse
import uvicorn
import subprocess
import os
import uuid
from threading import Lock
from validation import CrawlerRequest


app = FastAPI(
    title="Flexible Crawler API",
    description="API для запуска гибкого краулера на базе Scrapy",
    version="1.1.0"
)

# Папка, где будут сохраняться результаты
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")

if not os.path.exists(RESULTS_DIR):
    os.makedirs(RESULTS_DIR)

# Папка, где будут сохраняться схемы полученные с фронта
SCHEMAS_DIR = os.path.join(os.path.dirname(__file__), "schemas")

if not os.path.exists(SCHEMAS_DIR):
    os.makedirs(SCHEMAS_DIR)

# Словарь для хранения статусов задачи и формата выходного файла
task_data = {}
status_lock = Lock()

@app.get("/")
def read_root():
    return {"message": "Flexible Crawler API is running"}


@app.post("/start_crawler")
def start_crawler(data: dict, background_tasks: BackgroundTasks):
    """
    Эндпоинт для запуска краулера.
    Принимает JSON с параметрами парсинга (start_url, crawler_settings, meta).
    """

    # Генерируем уникальный ID задачи
    task_id = str(uuid.uuid4())

    # Валидация входящих данных
    try:
        validated_data = CrawlerRequest(**data)
    except ValidationError as e:
        return {"task_id": task_id, "status": "Validation failed", "details": e.errors()}

    # Сохраняем полученный JSON во временный файл (или в базу) —
    # затем паук сможет прочитать этот файл, чтобы знать, что именно парсить.
    config_path = os.path.join(SCHEMAS_DIR, f"{task_id}_config.json")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(validated_data.model_dump_json())

    # Результат будем складывать в файл с таким же Task ID
    output_format = validated_data.crawler_settings.output_file_format
    output_path = os.path.join(RESULTS_DIR, f"{task_id}_result.{output_format}")

    # Обновляем статус задачи
    with status_lock:
        task_data[task_id] = {"status": "in_progress", "format": output_format}

    # Запускаем Scrapy через subprocess, передавая нужные аргументы
    # Обратите внимание, что flexible_spider должен уметь получать task_id и config_path
    # для дальнейшей работы
    # Надо обсудить, запускать через scrapy API или оставить так
    cmd = [
        "scrapy",
        "crawl",
        "flexible_spider",
        "-a", f"config_path={config_path}",
        "-a", f"output_path={output_path}",
        "-a", f"output_format={output_format}"
    ]

    # Функция для обновления статуса задачи
    def run_crawler():
        subprocess.run(cmd, cwd=os.path.join(os.path.dirname(__file__), "..", "flex_crawler"))
        with status_lock:
            task_data[task_id]["status"] = "completed"

    # Запускаем краулер в фоне
    background_tasks.add_task(run_crawler)

    return {"task_id": task_id, "status": "Crawler started"}


@app.get("/status/{task_id}")
def get_status(task_id: str):
    """
    Эндпоинт для получения статуса задачи по Task ID.
    Возвращает статус: in_progress, completed, или not_found.
    """
    with status_lock:
        current_data = task_data.get(task_id, None)

    if current_data is None:
        return {"task_id": task_id, "status": "not_found"}

    return {"task_id": task_id, "status": current_data["status"]}



@app.get("/result/{task_id}")
def get_result(task_id: str):
    """
    Эндпоинт для получения файла результата задачи по Task ID.
    Возвращает файл в заданном формате.
    """
    with status_lock:
        current_data = task_data.get(task_id, None)

    if current_data["status"] == "completed":
        output_format = current_data["format"]
        output_path = os.path.join(RESULTS_DIR, f"{task_id}_result.{output_format}")

        if os.path.exists(output_path):
            return FileResponse(
                path=output_path,
                filename=f"{task_id}_result.{output_format}",
                media_type="application/octet-stream"
            )


@app.delete("/delete/{task_id}")
def delete_files(task_id: str):
    """
    Эндпоинт для удаления промежуточной схемы и результата задачи по Task ID.
    Возвращает сообщение с результатом, какие файлы были удалены
    """
    with status_lock:
        current_data = task_data.get(task_id, None)

    if not current_data:
        return {"task_id": task_id, "status": "not_found", "message": "Task ID not found."}

    # Путь к файлам
    config_path = os.path.join(SCHEMAS_DIR, f"{task_id}_config.json")
    output_format = current_data["format"]
    output_path = os.path.join(RESULTS_DIR, f"{task_id}_result.{output_format}")

    # Удаление файлов, если они существуют
    files_deleted = []
    for file_path in [config_path, output_path]:
        if os.path.exists(file_path):
            os.remove(file_path)
            files_deleted.append(file_path)

    # Удаляем запись о задаче из словаря статусов
    del task_data[task_id]

    return {
        "task_id": task_id,
        "status": "deleted",
        "deleted_files": files_deleted,
        "message": "Files and task data successfully deleted." if files_deleted else "No files found to delete."
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
