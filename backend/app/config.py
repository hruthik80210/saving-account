"""
Application configuration using Pydantic Settings.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Optional


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    APP_NAME: str = "Savings Account Interest Calculator"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./savings_calculator.db"

    # Supabase credentials (optional for demo/local, required for production)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None
    ALLOW_DEMO_AUTH: bool = True

    # Banking calculation defaults
    DEFAULT_DAY_COUNT_CONVENTION: str = "ACTUAL_365"
    ROUNDING_MODE: str = "HALF_UP"
    ALLOW_NEGATIVE_BALANCE: bool = False

    # Static / demo data seeding controls.
    # Set AUTO_SEED_DEMO_DATA=false to start with a completely empty database and
    # only keep the records you create yourself.
    AUTO_SEED_DEMO_DATA: bool = True
    SEED_DEFAULT_SLABS: bool = True

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "*"]

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
