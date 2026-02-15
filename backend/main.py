from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from backend.database import engine, init_db
from backend.api import router

app = FastAPI(
    title="Zerno Web3 App",
    description="Web3 приложение на FastAPI",
    version="1.0.0"
)

# CORS для работы с фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(router, prefix="/api")

# Статические файлы (если нужно)
# app.mount("/static", StaticFiles(directory="frontend/static"), name="static")


@app.on_event("startup")
async def startup_event():
    """Инициализация базы данных при запуске"""
    init_db()


@app.get("/")
async def root():
    return {"message": "Zerno Web3 API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}












