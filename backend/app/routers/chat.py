import json
from datetime import timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from ..database import SessionLocal
from ..models import Message, Room, User
from ..security import decode_token
from ..ws import manager

router = APIRouter()


def message_to_dict(m: Message) -> dict:
    created = m.created_at
    if created.tzinfo is None:  # SQLite returns naive datetimes
        created = created.replace(tzinfo=timezone.utc)
    return {
        "type": "message",
        "id": m.id,
        "user_id": m.user.id,
        "user": m.user.username,
        "avatar_version": m.user.avatar_version,
        "content": m.content,
        "created_at": created.isoformat(),
    }


def authenticate(token: str, room_id: int):
    """Return (user_id, username) if the token and room are valid, else None."""
    user_id = decode_token(token)
    if not user_id:
        return None
    with SessionLocal() as db:
        user = db.get(User, user_id)
        room = db.get(Room, room_id)
        if not user or not room:
            return None
        return user.id, user.username


def load_history(room_id: int, limit: int = 50) -> list[dict]:
    with SessionLocal() as db:
        rows = db.scalars(
            select(Message)
            .where(Message.room_id == room_id)
            .order_by(Message.id.desc())
            .limit(limit)
        ).all()
        return [message_to_dict(m) for m in reversed(rows)]


def save_message(room_id: int, user_id: int, content: str) -> dict:
    with SessionLocal() as db:
        msg = Message(room_id=room_id, user_id=user_id, content=content)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return message_to_dict(msg)


@router.websocket("/ws/rooms/{room_id}")
async def room_socket(websocket: WebSocket, room_id: int, token: str = ""):
    auth = authenticate(token, room_id)
    if auth is None:
        await websocket.close(code=1008)  # policy violation
        return
    user_id, username = auth

    await manager.connect(room_id, websocket, username)
    try:
        await websocket.send_json({"type": "history", "messages": load_history(room_id)})
        await manager.broadcast(
            room_id, {"type": "presence", "users": manager.online_users(room_id)}
        )

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(data, dict):
                continue

            kind = data.get("type")
            if kind == "message":
                content = str(data.get("content", "")).strip()
                if not content or len(content) > 2000:
                    continue
                msg = save_message(room_id, user_id, content)
                await manager.broadcast(room_id, msg)
            elif kind == "typing":
                await manager.broadcast(
                    room_id, {"type": "typing", "user": username}, exclude=websocket
                )
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        manager.disconnect(room_id, websocket)
        await manager.broadcast(
            room_id, {"type": "presence", "users": manager.online_users(room_id)}
        )