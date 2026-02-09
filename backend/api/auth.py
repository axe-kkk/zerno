from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from backend.database import get_session
from backend.models import User
from backend.schemas import LoginRequest, TokenResponse
from backend.auth import verify_password, create_access_token, get_current_user

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest,
    session: Session = Depends(get_session)
):
    """Вход в систему и получение JWT токена"""
    # Поиск пользователя
    user = session.exec(
        select(User).where(User.username == login_data.username)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невірне ім'я користувача або пароль"
        )
    
    # Проверка пароля
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невірне ім'я користувача або пароль"
        )
    
    # Проверка активности
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Користувач неактивний"
        )
    
    # Создание токена
    access_token = create_access_token(user)
    
    return TokenResponse(access_token=access_token)


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user)
):
    """Выход из системы
    
    Примечание: JWT токены stateless, поэтому токен остается валидным до истечения срока.
    Клиент должен удалить токен на своей стороне.
    """
    return {
        "message": "Успішний вихід з системи",
        "username": current_user.username
    }

