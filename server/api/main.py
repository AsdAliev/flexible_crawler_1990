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


@app.get("/")
def read_root():
    return {"message": "Flexible Crawler API is running"}


@app.post("/jobs/", status_code=201)
def schedule_job(req: CrawlerRequest, user=Depends(get_current_user)):
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

    return JSONResponse(status_code=201, content={"jobid": data["jobid"]})


@app.get("/jobs/{jobid}/status")
def job_status(jobid: str):
    try:
        resp = requests.get(
            f"{SCRAPYD_URL}/listjobs.json",
            params={"project": PROJECT_NAME},
            timeout=5,
        )
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Ошибка связи с Scrapyd: {e}")

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Scrapyd вернул ошибку")

    jobs = resp.json()
    for state in ("pending", "running", "finished"):
        if any(j["id"] == jobid for j in jobs.get(state, [])):
            _history_update(jobid, status=state)
            return {"jobid": jobid, "status": state}

    raise HTTPException(status_code=404, detail="Job not found")


@app.get("/jobs/{jobid}/result")
def job_result(jobid: str, output_format: Literal["json", "csv", "xml"] = "json"):
    # Проверяем статус задачи
    status_resp = job_status(jobid)
    status = status_resp.get("status")
    if status != "finished":
        return JSONResponse(
            status_code=202,
            content={"jobid": jobid, "status": status, "message": "Job not finished yet"},
        )

    jl_path = os.path.join(
        ITEMS_DIR, PROJECT_NAME, "flexible_spider", f"{jobid}.jl"
    )
    if not os.path.exists(jl_path):
        raise HTTPException(status_code=404, detail="Result file not found")

    # _history_update(jobid, status="finished", result_path=jl_path)

    try:
        items = read_items_from_jl(jl_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Result file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при чтении результатов: {e}")

    tmp_base = f"/tmp/{jobid}"

    if output_format == "json":
        out_path = tmp_base + ".json"
        try:
            write_json_file(items, out_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка при создании JSON: {e}")
        return FileResponse(out_path, filename=f"{jobid}.json", media_type="application/json")

    if output_format == "csv":
        out_path = tmp_base + ".csv"
        try:
            write_csv_file(items, out_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка при создании CSV: {e}")
        return FileResponse(out_path, filename=f"{jobid}.csv", media_type="text/csv")

    # format == "xml"
    out_path = tmp_base + ".xml"
    try:
        write_xml_file(items, out_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при создании XML: {e}")
    return FileResponse(out_path, filename=f"{jobid}.xml", media_type="application/xml")
