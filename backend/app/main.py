from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers the tables)
from .config import settings
from .database import Base, engine
from .routers import auth, chat, dms, friends, presence, rooms, users

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Realtime Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(friends.router)
app.include_router(rooms.router)
app.include_router(dms.router)
app.include_router(chat.router)
app.include_router(presence.router)


@app.get("/health")
def health():
    return {"status": "ok"}