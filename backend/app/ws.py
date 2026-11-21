import logging

from anyio import from_thread
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Who is currently viewing which room (one entry per open room socket)."""

    def __init__(self):
        self.rooms: dict[int, dict[WebSocket, tuple[int, str]]] = {}

    async def connect(self, room_id: int, ws: WebSocket, user_id: int, username: str):
        await ws.accept()
        self.rooms.setdefault(room_id, {})[ws] = (user_id, username)

    def disconnect(self, room_id: int, ws: WebSocket):
        conns = self.rooms.get(room_id)
        if conns is None:
            return
        conns.pop(ws, None)
        if not conns:
            del self.rooms[room_id]

    def online_users(self, room_id: int) -> list[str]:
        return sorted({name for _, name in self.rooms.get(room_id, {}).values()})

    def connected_user_ids(self, room_id: int) -> set[int]:
        return {uid for uid, _ in self.rooms.get(room_id, {}).values()}

    async def broadcast(self, room_id: int, data: dict, exclude: WebSocket | None = None):
        for ws in list(self.rooms.get(room_id, {})):
            if ws is exclude:
                continue
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(room_id, ws)

    async def kick_user(self, room_id: int, user_id: int):
        """Close a user's sockets in a room, for example after they leave a group."""
        for ws, (uid, _) in list(self.rooms.get(room_id, {}).items()):
            if uid == user_id:
                self.disconnect(room_id, ws)
                await self._close(ws)
        await self.broadcast(room_id, {"type": "presence", "users": self.online_users(room_id)})

    async def close_room(self, room_id: int):
        for ws in list(self.rooms.get(room_id, {})):
            self.disconnect(room_id, ws)
            await self._close(ws)

    @staticmethod
    async def _close(ws: WebSocket):
        try:
            await ws.close(code=1008)
        except Exception:
            pass


class UserHub:
    """One entry per logged-in user with the app open. Used for online status
    and for pushing small notifications (friend requests, new rooms, new messages)."""

    def __init__(self):
        self.sockets: dict[int, set[WebSocket]] = {}

    def is_online(self, user_id: int) -> bool:
        return bool(self.sockets.get(user_id))

    async def connect(self, user_id: int, ws: WebSocket) -> bool:
        """Returns True if this is the user's first open connection (they just came online)."""
        await ws.accept()
        first = not self.sockets.get(user_id)
        self.sockets.setdefault(user_id, set()).add(ws)
        return first

    def disconnect(self, user_id: int, ws: WebSocket) -> bool:
        """Returns True if the user has no connections left (they went offline)."""
        conns = self.sockets.get(user_id)
        if not conns:
            return False
        conns.discard(ws)
        if not conns:
            del self.sockets[user_id]
            return True
        return False

    async def send_to_users(self, user_ids, data: dict):
        for uid in set(user_ids):
            for ws in list(self.sockets.get(uid, ())):
                try:
                    await ws.send_json(data)
                except Exception:
                    self.disconnect(uid, ws)


manager = ConnectionManager()
hub = UserHub()


def run_async(func, *args):
    """Call an async helper from a normal (sync) endpoint. Notifications are
    best effort, so a failure here is logged and never breaks the request."""
    try:
        from_thread.run(func, *args)
    except Exception:
        logger.exception("notification failed")