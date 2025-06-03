import os
import json
import datetime as dt
from typing import Literal

import requests
import sqlite3
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from authorization import get_current_user, router as auth_router
from models import CrawlerRequest
from history import router as history_router
from utils import (
    read_items_from_jl,
    write_json_file,
    write_csv_file,
    write_xml_file,
)

app = FastAPI(
    title="Flexible Crawler API",
    description="API для запуска и получения результата гибкого краулера на базе Scrapy + Scrapyd",
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

# Подключаем маршруты
app.include_router(auth_router)
app.include_router(history_router)

SCRAPYD_URL = os.getenv("SCRAPYD_URL", "http://localhost:6800")
PROJECT_NAME = os.getenv("PROJECT_NAME", "flex_crawler")
ITEMS_DIR = os.getenv("ITEMS_DIR", "/scrapyd/items")
DB_PATH = "users.db"


def _history_update(task_id: str, **cols) -> None:
    """
    Обновляет любые поля записи в crawler_requests.
    Пример: _history_update(task_id, status='completed', result_path='results/...')
    """
    if not cols:
        return
    sets = ", ".join(f"{k}=?" for k in cols)  # status=?, result_path=? …
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            f"""
            UPDATE crawler_requests
               SET {sets},
                   updated_at=?
             WHERE task_id=?""",
            list(cols.values()) + [dt.datetime.utcnow(), task_id],
        )


def _scrapyd_request(path: str, method: str = "GET", data: dict | None = None, params: dict | None = None) -> dict:
    """
    Внутренний хелпер для запросов к Scrapyd.
    Возвращает распарсенный JSON или бросает HTTPException.
    """
    url = f"{SCRAPYD_URL}/{path}"
    try:
        if method.upper() == "POST":
            resp = requests.post(url, data=data, timeout=5)
        else:
            resp = requests.get(url, params=params, timeout=5)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Ошибка связи с Scrapyd: {e}")

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Scrapyd вернул ошибку")

    try:
        return resp.json()
    except ValueError:
        raise HTTPException(status_code=500, detail="Невалидный JSON от Scrapyd")


def _fetch_task_status(task_id: str) -> str:
    """
    Возвращает строку состояния задачи: pending, running или finished.
    Бросает HTTPException(404), если task_id не найден.
    """
    data = _scrapyd_request("listjobs.json", method="GET", params={"project": PROJECT_NAME})
    for state in ("pending", "running", "finished"):
        if any(j["id"] == task_id for j in data.get(state, [])):
            return state
    raise HTTPException(status_code=404, detail="Job not found")


@app.get("/")
def read_root():
    return {"message": "Flexible Crawler API is running"}


@app.post("/start_crawler")
def start_crawler(req: CrawlerRequest, user=Depends(get_current_user)):
    payload = {
        "project": PROJECT_NAME,
        "spider": "flexible_spider",
        "config": json.dumps(req.dict(), ensure_ascii=False),
    }

    try:
        resp = requests.post(f"{SCRAPYD_URL}/schedule.json", data=payload, timeout=5)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Ошибка связи с Scrapyd: {e}")

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Scrapyd вернул ошибку")

    data = resp.json()
    if data.get("status") != "ok" or "jobid" not in data:
        raise HTTPException(status_code=500, detail="Не удалось запланировать spider")

    if user is not None:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                INSERT INTO crawler_requests
                      (user_id, task_id, start_url, payload_json)
                VALUES (?, ?, ?, ?)
                """,
                (user["id"],                # гарантирует, что задача «чья-то»
                 data["jobid"],
                 req.start_url,
                 req.model_dump_json())
            )

    return JSONResponse(status_code=200, content={"task_id": data["jobid"], "status": "crawler started"})


@app.get("/status/{task_id}")
def get_status(task_id: str):
    """
    Эндпоинт для получения статуса задачи по Task ID.
    Возвращает статус: pending, running, finished.
    """
    try:
        state = _fetch_task_status(task_id)
    except HTTPException as exc:
        if exc.status_code == 404:
            return JSONResponse(
                status_code=404,
                content={"task_id": task_id, "description": "Такой задачи не существует"},
            )
        raise

    _history_update(task_id, status=state)
    return JSONResponse(content={"task_id": task_id, "status": state})


@app.get("/result/{task_id}")
def get_result(task_id: str, output_format: Literal["json", "csv", "xml"] = "json"):
    # Проверяем статус задачи
    try:
        state = _fetch_task_status(task_id)
    except HTTPException as exc:
        if exc.status_code == 404:
            return JSONResponse(
                status_code=404,
                content={"task_id": task_id, "description": "Такой задачи не существует"},
            )
        raise

    if state != "finished":
        _history_update(task_id, status=state)
        return JSONResponse(
            status_code=202,
            content={
                "task_id": task_id,
                "status": state,
                "message": "Задание еще не выполнено. Попробуйте позже",
            },
        )

    jl_path = os.path.join(ITEMS_DIR, PROJECT_NAME, "flexible_spider", f"{task_id}.jl")
    if not os.path.exists(jl_path):
        return JSONResponse(
            status_code=404,
            content={"task_id": task_id, "description": "Файл для данной задачи не найден"},
        )

    _history_update(task_id, status=state, result_path=jl_path)
    try:
        items = read_items_from_jl(jl_path)
        if not items:
            return JSONResponse(
                status_code=404,
                content={"task_id": task_id, "description": "Ошибка при краулинге, ничего не найдено"},
            )
    except Exception:
        return JSONResponse(
            status_code=404,
            content={"task_id": task_id, "description": "Ошибка при чтении файла результатов"},
        )

    tmp_base = f"/tmp/{task_id}"

    if output_format == "json":
        out_path = tmp_base + ".json"
        try:
            write_json_file(items, out_path)
        except Exception:
            return JSONResponse(
                status_code=500,
                content={"task_id": task_id, "description": "Ошибка при создании JSON"},
            )
        return FileResponse(path=out_path, filename=f"{task_id}.json", media_type="application/octet-stream")

    if output_format == "csv":
        out_path = tmp_base + ".csv"
        try:
            write_csv_file(items, out_path)
        except Exception:
            return JSONResponse(
                status_code=500,
                content={"task_id": task_id, "description": "Ошибка при создании CSV"},
            )
        return FileResponse(path=out_path, filename=f"{task_id}.csv", media_type="application/octet-stream")

    out_path = tmp_base + ".xml"
    try:
        write_xml_file(items, out_path)
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"task_id": task_id, "description": "Ошибка при создании XML"},
        )
    return FileResponse(path=out_path, filename=f"{task_id}.xml", media_type="application/octet-stream")


@app.delete("/delete/{task_id}")
def delete_result(task_id: str, user=Depends(get_current_user)):
    """
    Эндпоинт для удаления результата задачи (файла .jl) по task ID.
    Возвращает JSON с информацией о том, какие файлы были удалены.
    """
    if user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Путь до .jl-файла
    jl_path = os.path.join(ITEMS_DIR, PROJECT_NAME, "flexible_spider", f"{task_id}.jl")

    if not os.path.exists(jl_path):
        return JSONResponse(
            status_code=404,
            content={"jobid": task_id, "description": "Такой задачи не существует или файл уже удалён"},
        )

    try:
        os.remove(jl_path)
        deleted = [jl_path]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении файла: {e}")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "DELETE FROM crawler_requests WHERE task_id=? AND user_id=?",
                (task_id, user["id"]),
            )
    except Exception:
        deleted.append("Ошибка при удалении записи из БД")

    return JSONResponse(
        status_code=200,
        content={
            "jobid": task_id,
            "status": "deleted",
            "deleted_files": deleted,
            "message": "Результат задачи успешно удалён",
        },
    )
