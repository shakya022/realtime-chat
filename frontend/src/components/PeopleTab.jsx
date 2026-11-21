import { useEffect, useState } from "react";
import { searchUsers } from "../api";
import Avatar from "./Avatar";

const btn = "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50";
const primaryBtn = `${btn} bg-indigo-600 hover:bg-indigo-500 text-white`;
const subtleBtn = `${btn} bg-slate-700 hover:bg-slate-600 text-slate-200`;

function Title({ children }) {
  return (
    <p className="px-2 pb-1 text-xs uppercase tracking-wide text-slate-500">{children}</p>
  );
}

function PersonRow({ person, subtitle, online, children }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-700/40">
      <Avatar
        username={person.username}
        userId={person.id}
        version={person.avatar_version}
        size={32}
        online={online}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{person.username}</p>
        {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  );
}

export default function PeopleTab({
  friends,
  requests,
  onSendRequest,
  onAccept,
  onRemoveRequest,
  onUnfriend,
  onMessage,
  onJoin,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loadedQuery, setLoadedQuery] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  const trimmed = query.trim();
  const searching = trimmed.length >= 2;
  // Changes when friends or requests change, so search results refresh themselves
  const relationKey = `${friends.length}-${requests.incoming.length}-${requests.outgoing.length}`;

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await searchUsers(trimmed);
        if (!cancelled) {
          setResults(data);
          setLoadedQuery(trimmed);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, relationKey]);

  async function act(key, fn) {
    setError("");
    setBusyKey(key);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey("");
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setJoinError("");
    setJoining(true);
    try {
      await onJoin(joinCode.trim());
      setJoinCode("");
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  }

  function renderAction(u) {
    const key = `u${u.id}`;
    if (u.relation === "friends") {
      return (
        <button className={subtleBtn} onClick={() => act(key, () => onMessage(u.id))}>
          Message
        </button>
      );
    }
    if (u.relation === "request_sent") {
      return <span className="text-xs text-slate-400">Requested</span>;
    }
    if (u.relation === "request_received") {
      const req = requests.incoming.find((r) => r.user.id === u.id);
      return (
        <button
          className={primaryBtn}
          disabled={!req || busyKey === key}
          onClick={() => act(key, () => onAccept(req.id))}
        >
          Accept
        </button>
      );
    }
    return (
      <button
        className={primaryBtn}
        disabled={busyKey === key}
        onClick={() => act(key, () => onSendRequest(u.id))}
      >
        Add
      </button>
    );
  }

  const sortedFriends = [...friends].sort(
    (a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username)
  );
  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
      <div className="px-2 space-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by username"
          maxLength={30}
          className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>

      {searching && (
        <section>
          <Title>Search results</Title>
          {results.length === 0 ? (
            <p className="px-2 text-sm text-slate-500">
              {loadedQuery === trimmed ? "No one found." : "Searching..."}
            </p>
          ) : (
            results.map((u) => (
              <PersonRow key={u.id} person={u} subtitle={u.about}>
                {renderAction(u)}
              </PersonRow>
            ))
          )}
        </section>
      )}

      <section>
        <Title>Join a group</Title>
        <form onSubmit={handleJoin} className="px-2 space-y-2">
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Invite code"
              maxLength={20}
              className="flex-1 min-w-0 rounded-lg bg-slate-700 px-3 py-2 text-sm tracking-widest outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={joining || joinCode.trim().length < 4}
              className={primaryBtn}
            >
              Join
            </button>
          </div>
          {joinError && <p className="text-xs text-red-300">{joinError}</p>}
          <p className="text-xs text-slate-500">
            Ask a friend for their group's invite code. They can find it under Members &amp; invite.
          </p>
        </form>
      </section>

      {requests.incoming.length > 0 && (
        <section>
          <Title>Friend requests</Title>
          {requests.incoming.map((r) => (
            <PersonRow key={r.id} person={r.user} subtitle="wants to be your friend">
              <button
                className={primaryBtn}
                disabled={busyKey === `r${r.id}`}
                onClick={() => act(`r${r.id}`, () => onAccept(r.id))}
              >
                Accept
              </button>
              <button
                className={subtleBtn}
                disabled={busyKey === `r${r.id}`}
                onClick={() => act(`r${r.id}`, () => onRemoveRequest(r.id))}
              >
                Decline
              </button>
            </PersonRow>
          ))}
        </section>
      )}

      {requests.outgoing.length > 0 && (
        <section>
          <Title>Sent requests</Title>
          {requests.outgoing.map((r) => (
            <PersonRow key={r.id} person={r.user} subtitle="waiting for a reply">
              <button
                className={subtleBtn}
                disabled={busyKey === `r${r.id}`}
                onClick={() => act(`r${r.id}`, () => onRemoveRequest(r.id))}
              >
                Cancel
              </button>
            </PersonRow>
          ))}
        </section>
      )}

      <section>
        <Title>
          Friends ({onlineCount} online)
        </Title>
        {friends.length === 0 ? (
          <p className="px-2 text-sm text-slate-500">
            No friends yet. Search for someone above and send a request.
          </p>
        ) : (
          sortedFriends.map((f) => (
            <PersonRow
              key={f.id}
              person={f}
              online={f.online}
              subtitle={f.online ? "Online" : "Offline"}
            >
              <button
                className={subtleBtn}
                disabled={busyKey === `f${f.id}`}
                onClick={() => act(`f${f.id}`, () => onMessage(f.id))}
              >
                Message
              </button>
              <button
                title="Remove friend"
                aria-label={`Remove ${f.username} from friends`}
                className={subtleBtn}
                onClick={() => {
                  if (window.confirm(`Remove ${f.username} from your friends?`)) {
                    act(`f${f.id}`, () => onUnfriend(f.id));
                  }
                }}
              >
                ✕
              </button>
            </PersonRow>
          ))
        )}
      </section>
    </div>
  );
}