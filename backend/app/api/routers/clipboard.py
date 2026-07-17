"""Simple shared clipboard API for cross-device text sharing."""
from __future__ import annotations

import secrets
import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/clipboard", tags=["clipboard"])

# In-memory storage (use Redis in production)
_clipboard_store: dict[str, tuple[str, float]] = {}  # code -> (text, expires_at)
_cleanup_interval = 300  # 5 minutes


class ClipboardCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    ttl_seconds: int = Field(default=3600, ge=60, le=86400)  # 1 min to 24 hours


class ClipboardResponse(BaseModel):
    code: str
    text: str
    expires_at: float
    url: str


def _cleanup_expired() -> None:
    now = time.time()
    expired = [code for code, (_, exp) in _clipboard_store.items() if exp < now]
    for code in expired:
        _clipboard_store.pop(code, None)


def _generate_code() -> str:
    # Short, human-readable code (e.g., "a1b2-c3d4")
    return f"{secrets.token_hex(2)}-{secrets.token_hex(2)}"


@router.post("", response_model=ClipboardResponse)
async def create_clipboard(data: ClipboardCreate) -> ClipboardResponse:
    """Store text and return a short code for retrieval."""
    _cleanup_expired()
    
    code = _generate_code()
    expires_at = time.time() + data.ttl_seconds
    _clipboard_store[code] = (data.text, expires_at)
    
    return ClipboardResponse(
        code=code,
        text=data.text,
        expires_at=expires_at,
        url=f"/clipboard/{code}",
    )


@router.get("/{code}", response_model=ClipboardResponse)
async def get_clipboard(code: str) -> ClipboardResponse:
    """Retrieve text by code."""
    _cleanup_expired()
    
    if code not in _clipboard_store:
        raise HTTPException(status_code=404, detail="Clipboard not found or expired")
    
    text, expires_at = _clipboard_store[code]
    return ClipboardResponse(
        code=code,
        text=text,
        expires_at=expires_at,
        url=f"/clipboard/{code}",
    )


@router.delete("/{code}")
async def delete_clipboard(code: str) -> dict[str, str]:
    """Delete a clipboard entry."""
    if code not in _clipboard_store:
        raise HTTPException(status_code=404, detail="Not found")
    
    _clipboard_store.pop(code, None)
    return {"status": "deleted"}