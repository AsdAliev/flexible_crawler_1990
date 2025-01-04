from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import subprocess
import os
import uuid

app = FastAPI(
    title="Flexible Crawler API",
    description="API для запуска гибкого краулера на базе Scrapy",
    version="1.0.0"
)


# Модель для входящего JSON
class CrawlerRequest(BaseModel):
    # Степа доделай (четко пропиши все параметры, используя pydantic)
    start_url: str
    crawler_settings: Dict[str, Any]
    meta: list


# Папка, где будут сохраняться результаты
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")

if not os.path.exists(RESULTS_DIR):
    os.makedirs(RESULTS_DIR)


@app.get("/")
def read_root():
    return {"message": "Flexible Crawler API is running"}


@app.post("/start_crawler")
def start_crawler(data: CrawlerRequest, background_tasks: BackgroundTasks):
    """
    Эндпоинт для запуска краулера.
    Принимает JSON с параметрами парсинга (start_url, настройки краулера, meta).
    """
    # Генерируем уникальный ID задачи
    task_id = str(uuid.uuid4())

    # Сохраняем полученный JSON во временный файл (или в базу) —
    # затем паук сможет прочитать этот файл, чтобы знать, что именно парсить.
    config_path = os.path.join(RESULTS_DIR, f"{task_id}_config.json")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(data.model_dump_json())

    # Результат будем складывать в файл с таким же Task ID
    output_path = os.path.join(RESULTS_DIR, f"{task_id}_result.{data.crawler_settings.get('output_format', 'json')}")
    output_format = data.crawler_settings.get("output_format", "json")

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

    # Запускаем краулер в фоне
    background_tasks.add_task(subprocess.run, cmd, cwd=os.path.join(os.path.dirname(__file__), "..", "flex_crawler"))

    return {"task_id": task_id, "status": "Crawler started"}


@app.get("/result/{task_id}")
def get_result(task_id: str):
    """
    Эндпоинт для получения результата парсинга по Task ID
    """
    # Надо обсудить, как в итоге отдаем результат пользователю
    output_path = os.path.join(RESULTS_DIR, f"{task_id}_result.json")
    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8") as f:
            return {"task_id": task_id, "result": f.read()}
    else:
        return {"task_id": task_id, "status": "Result not ready or task does not exist"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
