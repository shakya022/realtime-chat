import { useCallback, useEffect, useState } from "react";
import { createRoom, listRooms } from "../api";
import Avatar from "./Avatar";
import ChatRoom from "./ChatRoom";
import ProfileModal from "./ProfileModal";

export default function Chat({ user, onLogout, onUserUpdate }) {
  const [rooms, setRooms] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const data = await listRooms();
      setRooms(data);
      setActiveId((prev) => prev ?? data[0]?.id ?? null);
      setError("");
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  // Load rooms now, then re-check every 10 seconds so rooms made by others appear
  useEffect(() => {
    loadRooms();
    const timer = setInterval(loadRooms, 10000);
    return () => clearInterval(timer);
  }, [loadRooms]);

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError("");
    try {
      const room = await createRoom(name);
      setRooms((prev) => [...prev, room].sort((a, b) => a.name.localeCompare(b.name)));
      setActiveId(room.id);
      setNewName("");
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }

  const activeRoom = rooms.find((r) => r.id === activeId);

  return (
    <div className="h-screen flex bg-slate-900 text-white">
      <aside className="w-64 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold">Realtime Chat</h1>
        </div>

        <button
          onClick={() => setShowProfile(true)}
          title="Edit profile"
          className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 hover:bg-slate-700/50 text-left"
        >
          <Avatar
            username={user.username}
            userId={user.id}
            version={user.avatar_version}
            size={40}
          />
          <div className="min-w-0">
            <p className="font-semibold truncate">{user.username}</p>
            <p className="text-xs text-slate-400 truncate">{user.about || "Edit profile"}</p>
          </div>
        </button>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <p className="px-2 text-xs uppercase tracking-wide text-slate-500">Rooms</p>
          {loading && <p className="px-2 text-sm text-slate-500">Loading...</p>}
          {!loading && rooms.length === 0 && (
            <p className="px-2 text-sm text-slate-500">No rooms yet. Create one below.</p>
          )}
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setActiveId(room.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                room.id === activeId
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              # {room.name}
            </button>
          ))}
        </nav>

        <form onSubmit={handleCreate} className="px-3 py-3 border-t border-slate-700 space-y-2">
          {error && <p className="text-xs text-red-300">{error}</p>}
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New room name"
            minLength={2}
            maxLength={50}
            className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm"
          >
            Create room
          </button>
        </form>

        <button
          onClick={onLogout}
          className="px-4 py-3 text-sm text-slate-400 hover:text-white border-t border-slate-700 text-left"
        >
          Log out
        </button>
      </aside>

      <main className="flex-1 min-w-0">
        {activeRoom ? (
          <ChatRoom key={`${activeRoom.id}-${user.username}`} room={activeRoom} user={user} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">
            {loading ? "Loading..." : "Create or pick a room to start chatting."}
          </div>
        )}
      </main>

      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onSaved={onUserUpdate}
        />
      )}
    </div>
  );
}