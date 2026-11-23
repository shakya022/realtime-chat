import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptRequest,
  createRoom,
  joinGroup,
  listFriends,
  listRequests,
  listRooms,
  openDm,
  removeRequest,
  sendFriendRequest,
  unfriend,
} from "../api";
import useUserSocket from "../useUserSocket";
import Avatar from "./Avatar";
import ChatRoom from "./ChatRoom";
import ChatsTab from "./ChatsTab";
import GroupPanel from "./GroupPanel";
import PeopleTab from "./PeopleTab";
import ProfileModal from "./ProfileModal";

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "text-white border-indigo-500"
          : "text-slate-400 border-transparent hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function Chat({ user, onLogout, onUserUpdate }) {
  const [rooms, setRooms] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [activeId, setActiveId] = useState(null);
  const [unread, setUnread] = useState({});
  const [tab, setTab] = useState("chats");
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const activeIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Runs an action. If the login expired, log out; otherwise pass the error on.
  const guard = useCallback(
    async (fn) => {
      try {
        return await fn();
      } catch (err) {
        if (err.status === 401) {
          onLogout();
          return undefined;
        }
        throw err;
      }
    },
    [onLogout]
  );

  const loadRooms = useCallback(async () => {
    try {
      const data = await listRooms();
      setRooms(data);
      setActiveId((prev) =>
        prev !== null && data.some((r) => r.id === prev) ? prev : (data[0]?.id ?? null)
      );
    } catch (err) {
      if (err.status === 401) onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  const loadFriends = useCallback(async () => {
    try {
      const [friendList, requestList] = await Promise.all([listFriends(), listRequests()]);
      setFriends(friendList);
      setRequests(requestList);
    } catch (err) {
      if (err.status === 401) onLogout();
    }
  }, [onLogout]);

  useEffect(() => {
    loadRooms();
    loadFriends();
  }, [loadRooms, loadFriends]);

  // Live updates pushed by the server
  useUserSocket({
    onConnected: () => {
      loadFriends();
      loadRooms();
    },
    onEvent: (event) => {
      if (event.type === "rooms_changed") {
        loadRooms();
      } else if (event.type === "friends_changed") {
        loadFriends();
      } else if (event.type === "presence") {
        setFriends((prev) =>
          prev.map((f) => (f.id === event.user_id ? { ...f, online: event.online } : f))
        );
      } else if (event.type === "new_message") {
        if (event.room_id !== activeIdRef.current) {
          setUnread((prev) => ({ ...prev, [event.room_id]: true }));
        }
      }
    },
  });

  function selectRoom(id) {
    setActiveId(id);
    setUnread((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // ----- actions used by the tabs -----
  const handleCreateGroup = (name) =>
    guard(async () => {
      const room = await createRoom(name);
      await loadRooms();
      selectRoom(room.id);
    });

  const handleJoin = (code) =>
    guard(async () => {
      const room = await joinGroup(code);
      await loadRooms();
      selectRoom(room.id);
      setTab("chats");
    });

  const handleMessage = (userId) =>
    guard(async () => {
      const room = await openDm(userId);
      await loadRooms();
      selectRoom(room.id);
      setTab("chats");
    });

  const handleSendRequest = (userId) =>
    guard(async () => {
      await sendFriendRequest(userId);
      await loadFriends();
    });

  const handleAccept = (requestId) =>
    guard(async () => {
      await acceptRequest(requestId);
      await loadFriends();
    });

  const handleRemoveRequest = (requestId) =>
    guard(async () => {
      await removeRequest(requestId);
      await loadFriends();
    });

  const handleUnfriend = (userId) =>
    guard(async () => {
      await unfriend(userId);
      await Promise.all([loadFriends(), loadRooms()]);
    });

  const activeRoom = rooms.find((r) => r.id === activeId);
  const otherOnline =
    activeRoom?.kind === "dm"
      ? Boolean(friends.find((f) => f.id === activeRoom.other_user?.id)?.online)
      : false;
  const hasUnread = Object.keys(unread).length > 0;

  return (
    <div className="h-screen flex bg-slate-900 text-white">
      <aside className="w-72 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
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

        <div className="flex border-b border-slate-700">
          <TabButton active={tab === "chats"} onClick={() => setTab("chats")}>
            Chats
            {hasUnread && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
          </TabButton>
          <TabButton active={tab === "people"} onClick={() => setTab("people")}>
            People
            {requests.incoming.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-xs">
                {requests.incoming.length}
              </span>
            )}
          </TabButton>
        </div>

        {tab === "chats" ? (
          <ChatsTab
            rooms={rooms}
            activeId={activeId}
            unread={unread}
            friends={friends}
            onSelect={selectRoom}
            onCreateGroup={handleCreateGroup}
          />
        ) : (
          <PeopleTab
            friends={friends}
            requests={requests}
            onSendRequest={handleSendRequest}
            onAccept={handleAccept}
            onRemoveRequest={handleRemoveRequest}
            onUnfriend={handleUnfriend}
            onMessage={handleMessage}
            onJoin={handleJoin}
          />
        )}

        <button
          onClick={onLogout}
          className="px-4 py-3 text-sm text-slate-400 hover:text-white border-t border-slate-700 text-left"
        >
          Log out
        </button>
      </aside>

      <main className="flex-1 min-w-0">
        {activeRoom ? (
          <ChatRoom
            key={`${activeRoom.id}-${user.username}`}
            room={activeRoom}
            user={user}
            otherOnline={otherOnline}
            onOpenInfo={() => setShowGroup(true)}
            onUserUpdate={onUserUpdate}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500 px-6 text-center">
            {loading ? (
              "Loading..."
            ) : (
              <>
                <p>Nothing here yet.</p>
                <p className="text-sm">
                  Create a group, join one with an invite code, or add friends in the People tab.
                </p>
              </>
            )}
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

      {showGroup && activeRoom?.kind === "group" && (
        <GroupPanel
          key={activeRoom.id}
          room={activeRoom}
          user={user}
          friends={friends}
          onClose={() => setShowGroup(false)}
          onChanged={loadRooms}
        />
      )}
    </div>
  );
}