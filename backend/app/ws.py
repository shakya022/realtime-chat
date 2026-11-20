from fastapi import WebSocket


class ConnectionManager:
    """Keeps track of who is connected to which room."""

    def __init__(self):
        self.rooms: dict[int, dict[WebSocket, str]] = {}

    async def connect(self, room_id: int, ws: WebSocket, username: str):
        await ws.accept()
        self.rooms.setdefault(room_id, {})[ws] = username

    def disconnect(self, room_id: int, ws: WebSocket):
        conns = self.rooms.get(room_id)
        if conns is None:
            return
        conns.pop(ws, None)
        if not conns:
            del self.rooms[room_id]

    def online_users(self, room_id: int) -> list[str]:
        return sorted(set(self.rooms.get(room_id, {}).values()))

    async def broadcast(self, room_id: int, data: dict, exclude: WebSocket | None = None):
        for ws in list(self.rooms.get(room_id, {})):
            if ws is exclude:
                continue
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(room_id, ws)


manager = ConnectionManager()
