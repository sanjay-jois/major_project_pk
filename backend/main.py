"""
main.py — FastAPI Application Entry Point.
"""
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.requests import Request

from .core.config import settings, ARTIFACTS_DIR
from .api.routes import router
from .services.training_service import training_service

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Check if models need initial training
    leaderboard_file = ARTIFACTS_DIR / "leaderboard.json"
    if not leaderboard_file.exists():
        print("[Startup] Initializing model benchmark training in background...")
        try:
            training_service.train_models()
            print("[Startup] Initial model training completed successfully.")
        except Exception as e:
            print(f"[Startup] Note on initial training: {e}")
    else:
        print("[Startup] Pre-existing trained model artifacts loaded.")
    yield
    # Shutdown
    print("[Shutdown] Cleaning up resources...")

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    description="Grey-Box Pharmacokinetic Modeling & Clinical Analytics Platform",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response

# Include API endpoints
app.include_router(router)

# Mount frontend files if frontend directory exists
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    async def serve_index():
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "Frontend index.html not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.host, port=settings.port, reload=settings.debug)
