from fastapi import Depends, HTTPException, status
from fastapi_jwt import JwtAccessBearer, JwtAuthorizationCredentials
from sqlmodel import Session, select
from passlib.context import CryptContext
from backend.database import get_session
from backend.models import User, UserRole
from backend.config import settings
from typing import Union

# Настройка JWT
access_security = JwtAccessBearer(
    secret_key=settings.jwt_secret_key,
    algorithm=settings.jwt_algorithm,
    auto_error=True
)

# Настройка хеширования паролей
# Используем ленивую инициализацию, чтобы избежать проблем с bcrypt при импорте
_pwd_context = None

def _get_pwd_context():
    """Получение контекста хеширования (ленивая инициализация)"""
    global _pwd_context
    if _pwd_context is None:
        _pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return _pwd_context


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля"""
    return _get_pwd_context().verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Хеширование пароля"""
    return _get_pwd_context().hash(password)


async def get_current_user(
    credentials: JwtAuthorizationCredentials = Depends(access_security),
    session: Session = Depends(get_session)
) -> User:
    """Получение текущего пользователя из JWT токена"""
    # В fastapi-jwt subject может быть dict или строкой
    subject = credentials.subject
    
    # Если subject - это dict, извлекаем username
    if isinstance(subject, dict):
        username = subject.get("username")
    else:
        # Если subject - это строка (username)
        username = subject
    
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невірні облікові дані"
        )
    
    user = session.exec(
        select(User).where(User.username == username)
    ).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Користувача не знайдено або він неактивний"
        )
    
    return user


async def get_current_super_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Проверка, что текущий пользователь - супер админ"""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостатньо прав доступу. Потрібен доступ супер адміна."
        )
    return current_user


def create_access_token(user: User) -> str:
    """Создание JWT токена для пользователя"""
    from datetime import timedelta
    
    # Создаем subject как dict с данными пользователя
    subject = {
        "username": user.username,
        "role": user.role.value,
        "user_id": user.id
    }
    
    expires_delta = timedelta(hours=settings.jwt_expiration_hours)
    
    return access_security.create_access_token(
        subject=subject,
        expires_delta=expires_delta
    )

