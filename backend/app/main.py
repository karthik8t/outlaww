from fastapi import FastAPI

from app.api.api import router
from app.logging_config import (
    register_exception_handlers,
    request_context_middleware,
    setup_logging,
)

setup_logging()

app = FastAPI(title="Outlaww", version="0.1.0")

# Middleware — request_id, timing, error recovery
app.middleware("http")(request_context_middleware)

# Clean JSON error responses instead of HTML tracebacks
register_exception_handlers(app)

app.include_router(router)
