from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Literal, Optional
import uvicorn
import subprocess
import os
import uuid
from threading import Lock


app = FastAPI(
    title="Flexible Crawler API",
    description="API для запуска гибкого краулера на базе Scrapy",
    version="1.0.0"
)

"""
Field(..., ) означает, что поле обязательное и у него нет значения по умолчанию, 
если его не будет, то появится ошибка валидации
Optional[int] = Field(0, ) - необязателное поле, если оно есть, то там лежит целое число,
если его нет, то автоматически назначится 0
"""

# Модель для описания селекторов
class Selector(BaseModel):
    path: str = Field(..., description="Путь до элемента на странице (XPath или CSS)")
    selector_type: Literal["xpath", "css"] = Field(..., description="Тип селектора: xpath или css")

# Модель для атрибутов объектов
class Attribute(BaseModel):
    attribute_name: str = Field(..., description="Уникальное имя атрибута для сбора данных")
    attribute_caption: str = Field(..., description="Читаемое имя атрибута для отображения")
    attribute_selector: Selector = Field(..., description="Селектор для поиска атрибута")
    attribute_type: Literal["simple", "array"] = Field(..., description="Тип атрибута: simple или array")
    delimiter: Optional[str] = Field(None, description="Разделитель для типа array")

# Модель для описания объектов
class ObjectMeta(BaseModel):
    object_name: str = Field(..., description="Уникальное имя объекта для сбора данных")
    object_caption: str = Field(..., description="Читаемое имя объекта для отображения")
    object_selector: Optional[Selector] = Field(None, description="Селектор для поиска объекта на странице")
    attributes: List[Attribute] = Field(..., description="Список атрибутов объекта")

# Модель для описания пагинации
class PaginationSettings(BaseModel):
    enabled: bool = Field(..., description="Включена ли пагинация")
    next_page_selector: Optional[Selector] = Field(None, description="XPath селектор для поиска кнопки следующей страницы")
    url_param_template: Optional[str] = Field(None, description="Шаблон параметра URL для пагинации")
    start_page: Optional[int] = Field(0, description="Номер стартовой страницы")
    max_pages: Optional[int] = Field(10, description="Максимальное количество страниц для парсинга")
    page_increment: Optional[int] = Field(1, description="Шаг переключения страниц")

# Модель для настроек краулера
class CrawlerSettings(BaseModel):
    request_headers: Optional[Dict[str, str]] = Field(None, description="Заголовки для HTTP-запросов") #возможно удалим
    request_delay: Optional[int] = Field(1, description="Задержка между запросами (в секундах)")
    output_file_format: Literal["json", "csv", "xml"] = Field(..., description="Формат файла для сохранения результатов")
    pagination: PaginationSettings = Field(..., description="Настройки пагинации")

# Основная модель для входящего запроса
class CrawlerRequest(BaseModel):
    start_url: str = Field(..., description="Начальный URL для парсинга")
    crawler_settings: CrawlerSettings = Field(..., description="Настройки краулера")
    meta: List[ObjectMeta] = Field(..., description="Список объектов и их атрибутов для сбора данных")


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
def start_crawler(data: CrawlerRequest, background_tasks: BackgroundTasks):
    """
    Эндпоинт для запуска краулера.
    Принимает JSON с параметрами парсинга (start_url, crawler_settings, meta).
    """
    # Генерируем уникальный ID задачи
    task_id = str(uuid.uuid4())

    # Сохраняем полученный JSON во временный файл (или в базу) —
    # затем паук сможет прочитать этот файл, чтобы знать, что именно парсить.
    config_path = os.path.join(SCHEMAS_DIR, f"{task_id}_config.json")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(data.model_dump_json())

    # Результат будем складывать в файл с таким же Task ID
    output_format = data.crawler_settings.output_file_format
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
