import base64
import binascii
import time

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import ProfileUpdate, UserOut

router = APIRouter(prefix="/users", tags=["users"])

MAX_AVATAR_BYTES = 150_000
JPEG_PREFIX = "data:image/jpeg;base64,"


def decode_avatar(data_url: str) -> bytes:
    if not data_url.startswith(JPEG_PREFIX):
        raise HTTPException(status_code=422, detail="Avatar must be a JPEG image")
    try:
        raw = base64.b64decode(data_url[len(JPEG_PREFIX):], validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=422, detail="Avatar data is not valid")
    if len(raw) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Avatar is too large")
    if not raw.startswith(b"\xff\xd8\xff"):  # real JPEG files start with these bytes
        raise HTTPException(status_code=422, detail="Avatar must be a JPEG image")
    return raw


@router.patch("/me", response_model=UserOut)
def update_me(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if data.username is not None and data.username != user.username:
        if db.scalar(select(User).where(User.username == data.username)):
            raise HTTPException(status_code=409, detail="Username already taken")
        user.username = data.username

    if data.about is not None:
        user.about = data.about.strip()

    if data.avatar is not None:
        if data.avatar == "":
            user.avatar = None
            user.avatar_version = 0
        else:
            user.avatar = decode_avatar(data.avatar)
            user.avatar_version = time.time_ns() // 1_000_000  # changes on every upload

    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}/avatar")
def get_avatar(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or not user.avatar:
        raise HTTPException(status_code=404, detail="No avatar")
    return Response(
        content=user.avatar,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )