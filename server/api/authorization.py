from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import sqlite3, bcrypt, jwt
from datetime import datetime, timedelta
from fastapi import APIRouter

router = APIRouter()


# === Константы ===
SECRET_KEY = "my_very_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXP_HOURS = 1
REFRESH_TOKEN_EXP_DAYS = 7

# === Init FastAPI & Auth ===
app = FastAPI()
security = HTTPBearer()

# === Хранилище отозванных access-токенов ===
revoked_tokens = set()

# === Инициализация БД ===
def init_db():
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()

init_db()

# === Инициализация БД 2 ===
def init_history_table() -> None:
    """
    Создаёт таблицу crawler_requests, если её ещё нет.

    • id – локальный autoincrement-ключ (можно не показывать пользователю);
    • user_id – владелец записи, ссылается на users(id);
    • task_id – строковый идентификатор задачи в Scrapy/планировщике;
    • start_url – URL, с которого начали краулинг;
    • payload_json – исходная конфигурация паука (храним целиком);
    • status – текущее состояние (‘in_progress’, ‘completed’, ‘error’);
    • result_path – относительный путь к сохранённому файлу результата;
    • created_at / updated_at – метки времени.
    """
    conn = sqlite3.connect("users.db")          # тот же файл, что и для users
    c = conn.cursor()

    # -- сама таблица -------------------------------------------------------
    c.execute("""
        CREATE TABLE IF NOT EXISTS crawler_requests (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       INTEGER    NOT NULL,
            task_id       TEXT       NOT NULL UNIQUE,
            start_url     TEXT       NOT NULL,
            payload_json  TEXT       NOT NULL,
            status        TEXT       NOT NULL DEFAULT 'in_progress',
            result_path   TEXT,
            created_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # -- индекс для быстрой выдачи «истории» пользователя -------------------
    c.execute("""
        CREATE INDEX IF NOT EXISTS idx_crawler_user_created
        ON crawler_requests (user_id, created_at DESC)
    """)

    conn.commit()
    conn.close()

init_history_table()

# === JWT генерация и проверка ===
def create_token(user_id: int, token_type="access"):
    if token_type == "access":
        exp = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXP_HOURS)
    elif token_type == "refresh":
        exp = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXP_DAYS)
    else:
        raise ValueError("Invalid token type")

    payload = {
        "user_id": user_id,
        "type": token_type,
        "exp": exp
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM), exp

def verify_token(token: str, expected_type="access"):
    if expected_type == "access" and token in revoked_tokens:
        raise HTTPException(status_code=401, detail="Token has been revoked")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != expected_type:
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# === Эндпоинты ===

@router.post("/register")
def register(data: dict):
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")
    
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

    try:
        conn = sqlite3.connect("users.db")
        c = conn.cursor()
        c.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, hashed))
        conn.commit()
        conn.close()
        return {"message": "User registered"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")

@router.post("/login")
def login(data: dict):
    username = data.get("username")
    password = data.get("password")
    
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,))
    result = c.fetchone()

    if not result or not bcrypt.checkpw(password.encode(), result[1]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = result[0]
    access_token, access_exp = create_token(user_id, "access")
    refresh_token, refresh_exp = create_token(user_id, "refresh")

    # Проверяем, сколько у пользователя уже refresh-токенов
    c.execute("SELECT id FROM refresh_tokens WHERE user_id = ? ORDER BY created_at ASC", (user_id,))
    existing_tokens = c.fetchall()
    if len(existing_tokens) >= 5:
        oldest_id = existing_tokens[0][0]
        c.execute("DELETE FROM refresh_tokens WHERE id = ?", (oldest_id,))

    # Сохраняем новый refresh-токен в БД
    c.execute("""
        INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
        VALUES (?, ?, ?, ?)
    """, (user_id, refresh_token, refresh_exp.isoformat(), datetime.utcnow().isoformat()))

    conn.commit()
    conn.close()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "access_expires": int(access_exp.timestamp())    # Unix-сек
    }

@router.post("/refresh")
def refresh_token(data: dict):
    token = data.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="Refresh token required")

    try:
        user_id = verify_token(token, expected_type="refresh")
    except HTTPException as e:
        # Если токен просрочен — пробуем удалить его из БД
        if e.detail == "Token expired":
            conn = sqlite3.connect("users.db")
            c = conn.cursor()
            c.execute("DELETE FROM refresh_tokens WHERE token = ?", (token,))
            conn.commit()
            conn.close()
        raise e

    conn = sqlite3.connect("users.db")
    c = conn.cursor()

    # Ищем токен в БД
    c.execute("SELECT id FROM refresh_tokens WHERE user_id = ? AND token = ?", (user_id, token))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Удаляем использованный refresh-токен
    c.execute("DELETE FROM refresh_tokens WHERE id = ?", (row[0],))

    # Ограничение на 5 токенов
    c.execute("SELECT id FROM refresh_tokens WHERE user_id = ? ORDER BY created_at ASC", (user_id,))
    existing_tokens = c.fetchall()
    if len(existing_tokens) >= 5:
        oldest_id = existing_tokens[0][0]
        c.execute("DELETE FROM refresh_tokens WHERE id = ?", (oldest_id,))

    # Генерируем новые токены
    new_access_token, _ = create_token(user_id, "access")
    new_refresh_token, refresh_exp = create_token(user_id, "refresh")

    c.execute("""
        INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
        VALUES (?, ?, ?, ?)
    """, (user_id, new_refresh_token, refresh_exp.isoformat(), datetime.utcnow().isoformat()))

    conn.commit()
    conn.close()

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token
    }

@router.get("/me")
def get_me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_id = verify_token(credentials.credentials)
    
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id, username, created_at FROM users WHERE id = ?", (user_id,))
    result = c.fetchone()
    conn.close()

    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"id": result[0], "username": result[1], "created_at": result[2]}

@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    user_id = verify_token(token)
    revoked_tokens.add(token)

    # Удаление refresh-токенов пользователя из БД
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("DELETE FROM refresh_tokens WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

    return {"message": "Token revoked and refresh token removed"}

@router.post("/change-password")
def change_password(data: dict, credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_id = verify_token(credentials.credentials)
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="Both old and new passwords required")

    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
    user = c.fetchone()

    if not user or not bcrypt.checkpw(old_password.encode(), user[0]):
        conn.close()
        raise HTTPException(status_code=401, detail="Incorrect old password")

    new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt())
    c.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
    conn.commit()
    conn.close()

    return {"message": "Password changed successfully"}


# экспорт роутера
__all__ = ["router"]

# === Очистка просроченых токенов === [реализована в /refresh]
# Фоновая периодическая задача
# (будет запускаться как сервис или просто по расписанию через cron)
# def clean_expired_tokens():
#     conn = sqlite3.connect("users.db")
#     c = conn.cursor()
#     c.execute("DELETE FROM refresh_tokens WHERE expires_at < ?", (datetime.utcnow().isoformat(),))
#     conn.commit()
#     conn.close()

