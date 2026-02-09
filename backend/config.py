from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Настройки приложения"""
    
    # Database
    database_url: str = "postgresql://user:password@localhost:5432/zerno_db"
    
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
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

