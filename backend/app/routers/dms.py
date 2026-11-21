from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Room, RoomMember, User
from ..schemas import DmOpen, RoomOut
from ..social import are_friends, dm_key, room_to_out
from ..ws import hub, run_async

router = APIRouter(prefix="/dms", tags=["personal chats"])


@router.post("", response_model=RoomOut)
def open_personal_chat(
    data: DmOpen,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Open (or create) the personal chat with one of your friends."""
    if data.user_id == user.id:
        raise HTTPException(status_code=400, detail="You can't message yourself")
    other = db.get(User, data.user_id)
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    if not are_friends(db, user.id, other.id):
        raise HTTPException(status_code=403, detail="You can only message your friends")

    key = dm_key(user.id, other.id)
    room = db.scalar(select(Room).where(Room.dm_key == key))
    if not room:
        room = Room(kind="dm", name=None, dm_key=key, created_by=user.id)
        db.add(room)
        db.flush()
        db.add(RoomMember(room_id=room.id, user_id=user.id))
        db.add(RoomMember(room_id=room.id, user_id=other.id))
        db.commit()
        db.refresh(room)
        run_async(hub.send_to_users, [other.id], {"type": "rooms_changed"})
    return room_to_out(db, room, user.id)