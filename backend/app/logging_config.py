"""Logging configuration for outlaww.

Provides structured logging with request context, workflow tracing,
and clean error responses for FastAPI.
"""

from __future__ import annotations

import logging
import sys
import time
import uuid
from contextvars import ContextVar
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
#  Request context — makes request_id available everywhere
# ---------------------------------------------------------------------------

request_id_var: ContextVar[str] = ContextVar("request_id", default="")


class RequestFilter(logging.Filter):
    """Inject request_id into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get("")
        return True


class RequestFormatter(logging.Formatter):
    """Compact log format with request_id for tracing."""

    def format(self, record: logging.LogRecord) -> str:
        req_id = getattr(record, "request_id", "")
        prefix = f"[{req_id[:8]}] " if req_id else ""
        return (
            f"{prefix}"
            f"{record.name.split('.')[-1]}:{record.lineno} "
            f"{record.levelname:7s} {record.getMessage()}"
        )


# ---------------------------------------------------------------------------
#  Setup
# ---------------------------------------------------------------------------

_LOG_FORMAT = "%(message)s"
_LOG_LEVEL = logging.INFO


def setup_logging() -> None:
    """Configure root logger with our formatter and filter."""
    root = logging.getLogger()
    root.setLevel(_LOG_LEVEL)

    # Remove existing handlers
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(_LOG_LEVEL)
    handler.setFormatter(RequestFormatter(_LOG_FORMAT))
    handler.addFilter(RequestFilter())

    root.addHandler(handler)

    # Quieten noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


# ---------------------------------------------------------------------------
#  Middleware — request_id generation + timing
# ---------------------------------------------------------------------------

async def request_context_middleware(request: Request, call_next):
    """Assign a short request_id and log timing for every request."""
    rid = uuid.uuid4().hex[:12]
    request_id_var.set(rid)

    start = time.perf_counter()
    method = request.method
    path = request.url.path

    logger = logging.getLogger("outlaww.http")
    logger.info(f"→ {method} {path}")

    try:
        response = await call_next(request)
    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        logger.error(f"✗ {method} {path} failed after {elapsed:.0f}ms: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "request_id": rid,
                "error": str(exc),
            },
        )

    elapsed = (time.perf_counter() - start) * 1000
    logger.info(f"← {method} {path} {response.status_code} ({elapsed:.0f}ms)")

    return response


# ---------------------------------------------------------------------------
#  Exception handlers for clean JSON responses
# ---------------------------------------------------------------------------

def register_exception_handlers(app: FastAPI) -> None:
    """Attach exception handlers that return clean JSON instead of HTML tracebacks."""

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        rid = request_id_var.get("")
        return JSONResponse(
            status_code=422,
            content={"detail": str(exc), "request_id": rid},
        )

    @app.exception_handler(KeyError)
    async def key_error_handler(request: Request, exc: KeyError) -> JSONResponse:
        rid = request_id_var.get("")
        return JSONResponse(
            status_code=404,
            content={"detail": f"Not found: {exc}", "request_id": rid},
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
        rid = request_id_var.get("")
        logger = logging.getLogger("outlaww.http")
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "request_id": rid,
                "error": str(exc),
            },
        )
