import subprocess
import os
import uuid
import json
import csv
import xml.etree.ElementTree as ET

from threading import Lock
from typing import Literal

import uvicorn

from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse

from models import CrawlerRequest

from fastapi.middleware.cors import CORSMiddleware
from authorization import router as auth_router 

import json, sqlite3, datetime as dt
from fastapi import Depends
from authorization import get_current_user    # <- уже существует в authorization.py

DB_PATH = "users.db"          # тот же файл, где уже лежит таблица users

def _history_update(task_id: str, **cols) -> None:
    """
    Обновляет любые поля записи в crawler_requests.
    Пример: _history_update(task_id, status='completed', result_path='results/...')
    """
    if not cols:
        return
    sets = ", ".join(f"{k}=?" for k in cols)           # status=?, result_path=? …
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            f"""
            UPDATE crawler_requests
               SET {sets},
                   updated_at=?
             WHERE task_id=?""",
            list(cols.values()) + [dt.datetime.utcnow(), task_id],
        )


app = FastAPI(
    title="Flexible Crawler API",
    description="API для запуска гибкого краулера на базе Scrapy",
    version="1.2.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # лучше явно указывать допустимые origin (фронтенд, расширение, и т.д.)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем маршруты из auth.py
app.include_router(auth_router)

# Создание папок для промежуточных результатов
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
SCHEMAS_DIR = os.path.join(os.path.dirname(__file__), "schemas")
for directory in [RESULTS_DIR, SCHEMAS_DIR]:
    if not os.path.exists(directory):
        os.makedirs(directory)

# Словарь для хранения статусов задачи и формата выходного файла
task_data = {}
status_lock = Lock()


@app.get("/")
def read_root():
    return {"message": "Flexible Crawler API is running"}


@app.post("/start_crawler")
def start_crawler(data: CrawlerRequest, background_tasks: BackgroundTasks, user = Depends(get_current_user)):
    """
    Эндпоинт для запуска краулера.
    Принимает JSON с параметрами парсинга (start_url, crawler_settings, meta).
    """

    # Генерируем уникальный ID задачи
    task_id = str(uuid.uuid4())

    for directory in [RESULTS_DIR, SCHEMAS_DIR]:
        if not os.path.exists(directory):
            os.makedirs(directory)

    # Сохраняем полученный JSON во временный файл (или в базу) —
    # затем паук сможет прочитать этот файл, чтобы знать, что именно парсить.
    config_path = os.path.join(SCHEMAS_DIR, f"{task_id}_config.json")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(data.model_dump_json())

    # Результат будем складывать в файл с таким же Task ID
    output_path = os.path.join(RESULTS_DIR, f"{task_id}_result.json")

    # Обновляем статус задачи
    with status_lock:
        task_data[task_id] = {"status": "in progress", "format": "json"}
    # ▸ Пишем строку в crawler_requests -----------------------------------
    if user is not None:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                INSERT INTO crawler_requests
                      (user_id, task_id, start_url, payload_json)
                VALUES (?, ?, ?, ?)
                """,
                (user["id"],                # гарантирует, что задача «чья-то»
                 task_id,
                 data.start_url,
                 data.model_dump_json())
            )
        

    # Запускаем Scrapy через subprocess, передавая нужные аргументы
    # Обратите внимание, что flexible_spider должен уметь получать task_id и config_path
    # для дальнейшей работы
    # Надо обсудить, запускать через scrapy API или оставить так
    cmd = [
        "scrapy",
        "crawl",
        "flexible_spider",
        "-a", f"config_path={config_path}",
        "-a", f"output_path={output_path}"
    ]

    # Функция для обновления статуса задачи
    def run_crawler():
        try:
            subprocess.run(cmd, cwd=os.path.join(os.path.dirname(__file__), "..", "flex_crawler"))
            with status_lock:
                task_data[task_id]["status"] = "completed"
            _history_update(task_id, status="completed")
        except subprocess.CalledProcessError as e:
            with status_lock:
                task_data[task_id]["status"] = "failed"
                task_data[task_id]["error"] = str(e)
            _history_update(task_id, status="failed")

    # Запускаем краулер в фоне
    background_tasks.add_task(run_crawler)

    return JSONResponse(
        content={
            "task_id": task_id,
            "status": "crawler started"
        },
        status_code=200
    )


@app.get("/status/{task_id}")
def get_status(task_id: str):
    """
    Эндпоинт для получения статуса задачи по Task ID.
    Возвращает статус: in_progress, completed, или not_found.
    """
    with status_lock:
        current_data = task_data.get(task_id, {})

    if not current_data:
        return JSONResponse(
            content={
                "task_id": task_id,
                "description": "Такой задачи не существует"
            },
            status_code=404
        )
        
    _history_update(task_id, status=current_data["status"])
    
    return JSONResponse(
        content={
            "task_id": task_id,
            "status": current_data["status"]
        },
        status_code=200
    )


@app.get("/result/{task_id}")
def get_result(task_id: str, output_format: Literal["json", "csv", "xml"] = "json"):
    """
    Эндпоинт для получения файла результата задачи по Task ID.
    Возвращает файл в заданном формате, либо сообщение об ошибке в формате JSON.
    """
    with status_lock:
        current_data = task_data.get(task_id, {})

    # Проверяем наличие задачи
    if not current_data:
        return JSONResponse(
            content={
                "task_id": task_id,
                "description": "Такой задачи не существует"
            },
            status_code=404
        )

    # Проверяем статус задачи
    if current_data["status"] == "in progress":
        return JSONResponse(
            content={
                "task_id": task_id,
                "status": "in progress",
                "message": "Задание еще не выполнено. Попробуйте позже"
            },
            status_code=202  # 202 Accepted — запрос принят, но не завершен
        )

    if current_data["status"] == "failed":
        raise JSONResponse(
            status_code=404,
            content={
                "task_id": task_id,
                "status": "failed",
                "error": current_data.get("error", "Неизвестная ошибка")
            }
        )

    # Путь к результату
    result_path = os.path.join(RESULTS_DIR, f"{task_id}_result.json")
    _history_update(task_id, status="completed", result_path=result_path)

    # Проверяем существование файла
    if not os.path.exists(result_path):
        return JSONResponse(
            content={
                "task_id": task_id,
                "description": "Файл для данной задачи не найден"
            },
            status_code=404
        )
    
    # Проверяем, есть ли результат краулинга
    with open(result_path, "r", encoding="utf-8") as f:
        try:
            items = json.load(f)
            if not items:
                return JSONResponse(
                    content={
                        "task_id": task_id,
                        "description": "Ошибка при краулинге, ничего не найдено"
                    },
                    status_code=404
                )
        except json.JSONDecodeError:
            return JSONResponse(
                content={
                    "task_id": task_id,
                    "description": "Ошибка при чтении файла результатов"
                },
                status_code=404
            )
    
    output_path = result_path.replace('.json', f'.{output_format}')
    
    if output_format == 'json':
        return FileResponse(
            path=output_path,
            filename=f"{task_id}_result.json",
            media_type="application/octet-stream"
        )
 
    if output_format == "csv":
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=items[0].keys())
            writer.writeheader()
            writer.writerows(items)
        
        return FileResponse(
            path=output_path,
            filename=f"{task_id}_result.csv",
            media_type="application/octet-stream"
        )
    
    if output_format == "xml":
        root = ET.Element("items")
        for item in items:
            item_element = ET.SubElement(root, "item")
            for key, value in item.items():
                child = ET.SubElement(item_element, key.replace(" ", "_"))
                child.text = str(value).replace("\xa0", " ")
        tree = ET.ElementTree(root)
        tree.write(output_path, encoding="utf-8", xml_declaration=True)

        return FileResponse(
            path=output_path,
            filename=f"{task_id}_result.xml",
            media_type="application/octet-stream"
        )

    return JSONResponse(
            content={
                "task_id": task_id,
                "description": "Неподдерживаемый формат файла"
            },
            status_code=422
        )


@app.delete("/delete/{task_id}")
def delete_files(task_id: str, user = Depends(get_current_user)):

    """
    Эндпоинт для удаления промежуточной схемы и результата задачи по Task ID.
    Возвращает JSON с результатом: какие файлы были удалены и статус задачи.
    """
    with status_lock:
        current_data = task_data.get(task_id, {})

    if not current_data:
        return JSONResponse(
            content={
                "task_id": task_id,
                "description": "Такой задачи не существует"
            },
            status_code=404
        )

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
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "DELETE FROM crawler_requests WHERE task_id=? AND user_id=?",
            (task_id, user["id"])
        )

    return JSONResponse(
        content={
            "task_id": task_id,
            "status": "deleted",
            "deleted_files": files_deleted,
            "message": (
                "Файлы и данные были успещно удалены"
                if files_deleted else
                "Файлов нет, но остальные данные были удалены"
            )
        },
        status_code=200
    )

from history import router as history_router
app.include_router(history_router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
