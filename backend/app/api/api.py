from fastapi import APIRouter

from app.api.routers.chat import router as chat_router
from app.api.routers.clipboard import router as clipboard_router

router = APIRouter()
router.include_router(chat_router)
router.include_router(clipboard_router)
