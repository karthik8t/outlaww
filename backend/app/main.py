from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.api import router
from app.logging_config import (
    register_exception_handlers,
    request_context_middleware,
    setup_logging,
)

setup_logging()

app = FastAPI(title="Outlaww", version="0.1.0")

# Allow all origins for LAN development (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware — request_id, timing, error recovery
app.middleware("http")(request_context_middleware)

# Clean JSON error responses instead of HTML tracebacks
register_exception_handlers(app)

app.include_router(router)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "outlaww-backend"}
