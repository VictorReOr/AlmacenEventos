import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api import assistant, auth, admin, inventory

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup Google Credentials from Env Var
    settings = get_settings()
    if settings.GOOGLE_APPLICATION_CREDENTIALS_JSON:
        creds_path = "/tmp/credentials.json"
        try:
            with open(creds_path, "w") as f:
                f.write(settings.GOOGLE_APPLICATION_CREDENTIALS_JSON)
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path
            print(f"Credentials Loaded to {creds_path}")
        except Exception as e:
            print(f"Error loading credentials: {e}")
    else:
        print("No credentials provided in env vars.")
    
    yield
    # Cleanup
    if os.path.exists("/tmp/credentials.json"):
        os.remove("/tmp/credentials.json")

app = FastAPI(
    title="Warehouse Assistant Brain 🧠",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5200", "http://localhost:5173"], # Explicitly allow dev ports
    allow_origin_regex=r"https?://(localhost|.*\.github\.io)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check and root endpoints
@app.get("/")
def read_root():
    return {"message": "Warehouse Assistant Brain is Active", "docs_url": "/docs"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(assistant.router, prefix="/api/v1/assistant", tags=["Assistant"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["Inventory"])
