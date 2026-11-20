from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Room, User
from ..schemas import RoomCreate, RoomOut

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=RoomOut, status_code=201)
def create_room(
    data: RoomCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    name = data.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Room name is too short")
    if db.scalar(select(Room).where(Room.name == name)):
        raise HTTPException(status_code=409, detail="Room name already exists")
    room = Room(name=name, created_by=user.id)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.get("", response_model=list[RoomOut])
def list_rooms(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.scalars(select(Room).order_by(Room.name)).all()