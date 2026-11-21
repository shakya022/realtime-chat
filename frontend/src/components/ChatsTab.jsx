import { useState } from "react";
import Avatar from "./Avatar";

function UnreadDot() {
  return <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0" />;
}

function rowClass(active) {
  return `w-full flex items-center gap-2 text-left rounded-lg px-3 py-2 text-sm transition-colors ${
    active ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700"
  }`;
}

export default function ChatsTab({ rooms, activeId, unread, friends, onSelect, onCreateGroup }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const groups = rooms.filter((r) => r.kind === "group");
  const dms = rooms.filter((r) => r.kind === "dm");

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");
    setBusy(true);
    try {
      await onCreateGroup(trimmed);
      setName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <section className="space-y-1">
          <p className="px-2 text-xs uppercase tracking-wide text-slate-500">Groups</p>
          {groups.length === 0 && (
            <p className="px-2 text-sm text-slate-500">
              No groups yet. Create one below, or join with a code in People.
            </p>
          )}
          {groups.map((room) => (
            <button
              key={room.id}
              onClick={() => onSelect(room.id)}
              className={rowClass(room.id === activeId)}
            >
              <span className="truncate flex-1"># {room.name}</span>
              {unread[room.id] && <UnreadDot />}
            </button>
          ))}
        </section>

        <section className="space-y-1">
          <p className="px-2 text-xs uppercase tracking-wide text-slate-500">Personal chats</p>
          {dms.length === 0 && (
            <p className="px-2 text-sm text-slate-500">
              No personal chats yet. Open People and message a friend.
            </p>
          )}
          {dms.map((room) => {
            const friend = friends.find((f) => f.id === room.other_user?.id);
            return (
              <button
                key={room.id}
                onClick={() => onSelect(room.id)}
                className={rowClass(room.id === activeId)}
              >
                {room.other_user && (
                  <Avatar
                    username={room.other_user.username}
                    userId={room.other_user.id}
                    version={room.other_user.avatar_version}
                    size={28}
                    online={Boolean(friend?.online)}
                  />
                )}
                <span className="truncate flex-1">{room.name}</span>
                {unread[room.id] && <UnreadDot />}
              </button>
            );
          })}
        </section>
      </nav>

      <form onSubmit={handleSubmit} className="px-3 py-3 border-t border-slate-700 space-y-2">
        {error && <p className="text-xs text-red-300">{error}</p>}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New group name"
          minLength={2}
          maxLength={50}
          className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 px-3 py-2 text-sm"
        >
          Create group
        </button>
      </form>
    </div>
  );
}