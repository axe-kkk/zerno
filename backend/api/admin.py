"""Адмін-ендпоінти (лише super_admin)."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from backend.auth import get_current_super_admin
from backend.models import User
from backend.backup import make_backup

router = APIRouter()


@router.get("/db/backup/download")
async def download_db_backup(current_admin: User = Depends(get_current_super_admin)):
    """Скачати ПОТОЧНУ резервну копію БД (.sql).

    На кожне натискання знімається свіжий `pg_dump` — щоб оператор завжди
    отримував БД у тому стані, в якому вона зараз. Фоновий планувальник
    (`backup_scheduler`) лишається як страховка на випадок аварії, але кнопка
    тепер не залежить від нього."""
    try:
        path = await make_backup()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не вдалося підготувати резервну копію: {e}",
        )
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return FileResponse(
        path,
        media_type="application/sql",
        filename=f"zerno_backup_{stamp}.sql",
    )
