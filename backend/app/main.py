from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings

# Import future routers here
from app.routers import assistant

# ... (omitted)

# Include routers
app.include_router(assistant.router, prefix="/api/v1/assistant", tags=["Assistant"])
