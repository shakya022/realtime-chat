from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..database import SessionLocal
from ..models import User
from ..security import decode_token
from ..social import friend_ids
from ..ws import hub

router = APIRouter()


def lookup_friends(user_id: int | None) -> list[int] | None:
    """None if the user doesn't exist, otherwise the ids of their friends."""
    if not user_id:
        return None
    with SessionLocal() as db:
        if db.get(User, user_id) is None:
            return None
        return friend_ids(db, user_id)


@router.websocket("/ws/me")
async def me_socket(websocket: WebSocket, token: str = ""):
    user_id = decode_token(token)
    friends = lookup_friends(user_id)
    if friends is None:
        await websocket.close(code=1008)
        return

    came_online = await hub.connect(user_id, websocket)
    try:
        if came_online:
            await hub.send_to_users(
                friends, {"type": "presence", "user_id": user_id, "online": True}
            )
        while True:
            await websocket.receive_text()  # keeps the connection open
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        if hub.disconnect(user_id, websocket):
            await hub.send_to_users(
                lookup_friends(user_id) or [],
                {"type": "presence", "user_id": user_id, "online": False},
            )