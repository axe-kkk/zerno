from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Any


class Settings(BaseSettings):
    """Настройки приложения"""
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )
    
    # Database
    database_url: str = "postgresql://user:password@localhost:5432/zerno_db"

    @field_validator("database_url", mode="before")
    @classmethod
    def database_url_strip_or_default(cls, v: Any) -> str:
        """Порожній рядок з env (часто з docker-compose) ламає create_engine — повертаємо дефолт."""
        if v is None:
            return "postgresql://user:password@localhost:5432/zerno_db"
        s = str(v).strip()
        if not s:
            return "postgresql://user:password@localhost:5432/zerno_db"
        return s
    
    # App
    app_name: str = "Zerno Web3 App"
    debug: bool = True
    secret_key: str = "your-secret-key-here"
    jwt_secret_key: str = "your-jwt-secret-key-here"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Super Admin (из .env)
    admin_username: str = "admin"
    admin_password: str = "admin123"
    admin_full_name: str = "Super Admin"


settings = Settings()

