"""Резервне копіювання БД.

Щодоби (і одразу при старті застосунку) знімається читабельний SQL-dump
у файл `BACKUP_FILE`, який **перезаписується** — на сервері завжди лежить
одна свіжа копія. Ендпоінт у `api/admin.py` віддає цей файл на скачування.
"""
import asyncio
import logging
import os
from pathlib import Path

from backend.config import settings

logger = logging.getLogger(__name__)

# Тека для бекапів. За замовчуванням — відносно робочої теки процесу:
#   Docker (WORKDIR /app) → /app/backups (змонтовано на host ./backups);
#   systemd (WorkingDirectory /opt/zerno) → /opt/zerno/backups.
# Можна перевизначити змінною оточення BACKUP_DIR.
BACKUP_DIR = Path(os.environ.get("BACKUP_DIR") or "backups").resolve()
BACKUP_FILE = BACKUP_DIR / "zerno_backup.sql"
BACKUP_INTERVAL_SEC = 24 * 60 * 60  # щодоби


def _database_url() -> str:
    return os.environ.get("DATABASE_URL") or settings.database_url


async def make_backup() -> Path:
    """Знімає читабельний SQL-dump БД і атомарно перезаписує BACKUP_FILE.

    Пишемо у тимчасовий файл і робимо os.replace — щоб скачування ніколи не
    натрапило на напівзаписаний файл."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    # tmp унікальний на процес (на проді uvicorn --workers 2 → планувальник
    # працює в кількох процесах; спільний .tmp могли б писати одночасно).
    tmp = BACKUP_FILE.with_name(f"{BACKUP_FILE.name}.{os.getpid()}.tmp")
    with open(tmp, "wb") as fh:
        proc = await asyncio.create_subprocess_exec(
            "pg_dump", _database_url(),
            "--no-owner", "--no-privileges", "--clean", "--if-exists",
            stdout=fh,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
    if proc.returncode != 0:
        try:
            tmp.unlink()
        except FileNotFoundError:
            pass
        raise RuntimeError(f"pg_dump завершився з кодом {proc.returncode}: "
                           f"{stderr.decode(errors='replace')[:500]}")
    os.replace(tmp, BACKUP_FILE)  # атомарна заміна
    logger.info("Резервну копію БД оновлено: %s (%d байт)",
                BACKUP_FILE, BACKUP_FILE.stat().st_size)
    return BACKUP_FILE


async def ensure_backup() -> Path:
    """Повертає шлях до бекапу; якщо файлу ще немає — створює його зараз."""
    if not BACKUP_FILE.exists():
        await make_backup()
    return BACKUP_FILE


async def backup_scheduler() -> None:
    """Фонова задача: знімає бекап одразу і далі щодоби (перезаписує файл).
    Помилка бекапу логуються, але не валять застосунок."""
    while True:
        try:
            await make_backup()
        except Exception as e:
            logger.error("Не вдалося зняти резервну копію БД: %s", e)
        await asyncio.sleep(BACKUP_INTERVAL_SEC)
