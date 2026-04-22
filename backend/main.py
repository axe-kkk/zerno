import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from backend.database import init_db
from backend.api import router

logger = logging.getLogger(__name__)

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
    """Инициализация базы данных при запуске (с повторами — DNS Docker «db» не всегда готов сразу)."""
    max_retries = 15
    delay_sec = 2.0
    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            await asyncio.to_thread(init_db)
            if attempt > 1:
                logger.info("База данных доступна з %s-ї спроби", attempt)
            return
        except OperationalError as e:
            last_error = e
            logger.warning(
                "БД ще недоступна (спроба %s/%s): %s",
                attempt,
                max_retries,
                e.orig if getattr(e, "orig", None) else e,
            )
            if attempt < max_retries:
                await asyncio.sleep(delay_sec)
    assert last_error is not None
    raise last_error


@app.get("/")
async def root():
    return {"message": "Zerno Web3 API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}













