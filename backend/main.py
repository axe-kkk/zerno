import asyncio
import logging
import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from backend.database import init_db
from backend.api import router
from backend.backup import backup_scheduler

logger = logging.getLogger(__name__)

# Регулярка ловить naive-ISO-рядки (без TZ-маркера) які Pydantic генерує
# з `datetime.utcnow()`. Приклад: "2026-06-25T15:36:42" або "2026-06-25T15:36:42.123456".
_NAIVE_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$")


def _add_z_to_naive_datetimes(obj):
    """Рекурсивно проходить response payload і додає `Z` до рядків що
    виглядають як naive ISO-datetime. Це робить дату однозначно UTC для
    браузера (який інакше інтерпретує наївний ISO як локальний час)."""
    if isinstance(obj, str):
        if _NAIVE_ISO_RE.match(obj):
            return obj + "Z"
        return obj
    if isinstance(obj, dict):
        return {k: _add_z_to_naive_datetimes(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_add_z_to_naive_datetimes(v) for v in obj]
    return obj


class UTCJSONResponse(JSONResponse):
    """JSONResponse що позначає всі naive-UTC datetime-и маркером Z.
    Без цього таблиці у фронті відстають від справжнього часу на TZ-офсет
    (3 години у Києві влітку), бо браузер бачить ISO-рядок без зони і
    припускає що це місцевий час."""
    def render(self, content) -> bytes:
        return super().render(_add_z_to_naive_datetimes(content))


app = FastAPI(
    title="Zerno Web3 App",
    description="Web3 приложение на FastAPI",
    version="1.0.0",
    default_response_class=UTCJSONResponse,
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
            # Щодобовий бекап БД (знімається одразу і далі раз на добу)
            asyncio.create_task(backup_scheduler())
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













