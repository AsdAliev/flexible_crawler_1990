"""
Маршруты истории запросов:
    GET  /history            — список задач текущего пользователя (пагинация)
    GET  /history/{item_id}  — одна запись
    DELETE /history/{item_id}— удалить запись
    DELETE /history          — очистить всю историю
"""
import sqlite3, json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from authorization import get_current_user          # уже есть в проекте

DB_PATH = "users.db"                                # тот же файл БД

router = APIRouter(tags=["history"])


# ---------- helpers ------------------------------------------------------
def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    """Преобразуем sqlite3.Row в обычный dict + раскладываем payload_json"""
    d = dict(row)
    # payload_json хранится как TEXT — пробуем декодировать в объект
    try:
        d["payload"] = json.loads(d.pop("payload_json"))
    except Exception:
        d["payload"] = d.pop("payload_json")
    return d


# ---------- routes -------------------------------------------------------
@router.get("/history")
def list_history(
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """Вернуть задачи пользователя в обратном порядке времени создания."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT id, task_id, start_url, payload_json, status,
                   result_path, created_at, updated_at
              FROM crawler_requests
             WHERE user_id = ?
          ORDER BY created_at DESC
             LIMIT ? OFFSET ?
            """,
            (user["id"], limit, offset),
        ).fetchall()

    return [_row_to_dict(r) for r in rows]


@router.get("/history/{item_id}")
def get_history_item(item_id: int, user=Depends(get_current_user)):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            """
            SELECT id, task_id, start_url, payload_json, status,
                   result_path, created_at, updated_at
              FROM crawler_requests
             WHERE id = ? AND user_id = ?
            """,
            (item_id, user["id"]),
        ).fetchone()

    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")

    return _row_to_dict(row)


@router.delete("/history/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history_item(item_id: int, user=Depends(get_current_user)):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            "DELETE FROM crawler_requests WHERE id = ? AND user_id = ?",
            (item_id, user["id"]),
        )
        if cur.rowcount == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(user=Depends(get_current_user)):
    """Удалить все записи пользователя (например, «Очистить историю» в UI)."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM crawler_requests WHERE user_id = ?", (user["id"],))
    return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)
