from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "Warehouse Assistant Brain 🧠"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    
    # Google Cloud
    GOOGLE_PROJECT_ID: str = ""
    GOOGLE_SHEET_ID: str = ""
    GOOGLE_APPLICATION_CREDENTIALS_JSON: str = "" # JSON content as string
    
    # Security
    API_KEY: str = "" # Optional: for basic protection

    class Config:
        case_sensitive = True
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
