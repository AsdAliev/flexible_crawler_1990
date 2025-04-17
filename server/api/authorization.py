from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import sqlite3, bcrypt, jwt
from datetime import datetime, timedelta

# === Константы ===
SECRET_KEY = "my_very_secret_key"
ALGORITHM = "HS256"
TOKEN_EXP_HOURS = 1
revoked_tokens = set()

# === JWT генерация и проверка ===
def create_token(user_id: int):
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXP_HOURS)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    if token in revoked_tokens:
        raise HTTPException(status_code=401, detail="Token has been revoked")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# === Эндпоинты ===

@app.post("/register")
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

@app.post("/login")
def login(data: dict):
    username = data.get("username")
    password = data.get("password")
    
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,))
    result = c.fetchone()
    conn.close()

    if not result or not bcrypt.checkpw(password.encode(), result[1]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(result[0])
    return {"token": token}

@app.get("/me")
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

@app.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    revoked_tokens.add(token)
    return {"message": "Token has been revoked"}

