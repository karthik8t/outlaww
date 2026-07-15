from fastapi import FastAPI

from app.api.api import router

app = FastAPI(title="Outlaww", version="0.1.0")
app.include_router(router)
