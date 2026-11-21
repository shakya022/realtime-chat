import { useCallback, useEffect, useState } from "react";
import { addMember, leaveGroup, listMembers, resetInviteCode } from "../api";
import Avatar from "./Avatar";

export default function GroupPanel({ room, user, friends, onClose, onChanged }) {
  const [members, setMembers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [code, setCode] = useState(room.invite_code || "");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState("");

  const refresh = useCallback(async () => {
    try {
      setMembers(await listMembers(room.id));
      setLoaded(true);
    } catch (err) {
      setError(err.message);
    }
  }, [room.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const memberIds = new Set(members.map((m) => m.id));
  const addable = friends.filter((f) => !memberIds.has(f.id));

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy automatically. Select the code and copy it by hand.");
    }
  }

  async function handleReset() {
    if (!window.confirm("Create a new invite code? The old code will stop working.")) return;
    setError("");
    setBusy("reset");
    try {
      const updated = await resetInviteCode(room.id);
      setCode(updated.invite_code || "");
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function handleAdd(friend) {
    setError("");
    setBusy(`add${friend.id}`);
    try {
      await addMember(room.id, friend.id);
      await refresh();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function handleLeave() {
    if (!window.confirm(`Leave "${room.name}"? You will need a new invite to come back.`)) return;
    setError("");
    setBusy("leave");
    try {
      await leaveGroup(room.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy("");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-800 rounded-xl p-6 shadow-xl space-y-5 text-white"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate"># {room.name}</h2>
            <p className="text-xs text-slate-400">
              {loaded ? members.length : room.member_count} members
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Invite code</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-lg tracking-[0.3em] font-mono text-center select-all">
              {code}
            </code>
            <button
              onClick={copyCode}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            {room.is_owner && (
              <button
                onClick={handleReset}
                disabled={busy === "reset"}
                className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 px-3 py-2 text-sm"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Anyone with this code can join the group. Share it only with people you trust.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Members</h3>
          <div className="space-y-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-1 py-1">
                <Avatar
                  username={m.username}
                  userId={m.id}
                  version={m.avatar_version}
                  size={32}
                  online={m.online}
                />
                <span className="flex-1 truncate text-sm">
                  {m.username}
                  {m.id === user.id && <span className="text-slate-500"> (you)</span>}
                </span>
                {m.is_owner && (
                  <span className="text-xs rounded-full bg-slate-700 px-2 py-0.5 text-slate-300">
                    owner
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Add friends</h3>
          {!loaded ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : addable.length === 0 ? (
            <p className="text-sm text-slate-500">
              {friends.length === 0
                ? "You have no friends yet. Add some in the People tab."
                : "All your friends are already in this group."}
            </p>
          ) : (
            <div className="space-y-1">
              {addable.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-1 py-1">
                  <Avatar
                    username={f.username}
                    userId={f.id}
                    version={f.avatar_version}
                    size={32}
                    online={f.online}
                  />
                  <span className="flex-1 truncate text-sm">{f.username}</span>
                  <button
                    onClick={() => handleAdd(f)}
                    disabled={busy === `add${f.id}`}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-3 py-1 text-xs font-medium"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          onClick={handleLeave}
          disabled={busy === "leave"}
          className="w-full rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-60 px-4 py-2 text-sm"
        >
          Leave group
        </button>
      </div>
    </div>
  );
}