from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from backend.database import get_session
from backend.models import User, UserRole
from backend.schemas import UserCreate, UserResponse, UserUpdate
from backend.auth import get_current_user, get_current_super_admin, get_password_hash

router = APIRouter()


@router.post("/", response_model=UserResponse)
async def create_user(
    user: UserCreate,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_super_admin)
):
    """Создание нового пользователя (только для супер админа)"""
    # Проверка существования пользователя с таким username
    existing_user = session.exec(
        select(User).where(User.username == user.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Користувач з таким ім'ям вже існує"
        )
    
    # Создание пользователя с хешированным паролем
    password_hash = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        password_hash=password_hash,
        password_plain=user.password,  # Сохраняем пароль в открытом виде
        full_name=user.full_name,
        role=UserRole.USER  # Все новые пользователи получают роль user
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


@router.get("/", response_model=list[UserResponse])
async def get_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Получение списка всех пользователей (требуется авторизация)"""
    users = session.exec(select(User)).all()
    return users


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Получение информации о текущем пользователе"""
    return current_user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Получение пользователя по ID (требуется авторизация)"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Користувача не знайдено"
        )
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_super_admin)
):
    """Обновление пользователя (только для супер админа)"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Користувача не знайдено"
        )
    
    # Нельзя изменить супер админа
    if user.role == UserRole.SUPER_ADMIN and user.id != current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Не можна змінювати іншого супер адміна"
        )
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Если обновляется пароль, нужно его захешировать
    if "password" in update_data:
        new_password = update_data.pop("password")
        update_data["password_hash"] = get_password_hash(new_password)
        update_data["password_plain"] = new_password  # Сохраняем пароль в открытом виде
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    from datetime import datetime
    user.updated_at = datetime.utcnow()
    
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_super_admin)
):
    """Удаление пользователя (только для супер админа)"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Користувача не знайдено"
        )
    
    # Нельзя удалить супер админа
    if user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Не можна видалити супер адміна"
        )
    
    session.delete(user)
    session.commit()
    return {"message": "Користувача успішно видалено"}

