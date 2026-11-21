import { useEffect, useRef, useState } from "react";
import { WS_URL, getToken } from "../api";

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STATUS_INFO = {
  connecting: ["Connecting...", "bg-yellow-400"],
  connected: ["Connected", "bg-green-400"],
  disconnected: ["Reconnecting...", "bg-red-400"],
  rejected: ["Not allowed. Please log in again.", "bg-red-400"],
};

export default function ChatRoom({ room, user }) {
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [text, setText] = useState("");

  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimers = useRef({});
  const lastTypingSent = useRef(0);

  useEffect(() => {
    let stopped = false;
    let retryTimer;
    let attempts = 0;
    const timers = typingTimers.current;

    function showTyping(name) {
      setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
      clearTimeout(timers[name]);
      timers[name] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u !== name));
      }, 2000);
    }

    function connect() {
      setStatus("connecting");
      const token = encodeURIComponent(getToken() || "");
      const ws = new WebSocket(`${WS_URL}/ws/rooms/${room.id}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (stopped) return;
        attempts = 0;
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        if (stopped) return;
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === "history") {
          setMessages(data.messages);
        } else if (data.type === "message") {
          setMessages((prev) => [...prev, data]);
          setTypingUsers((prev) => prev.filter((u) => u !== data.user));
        } else if (data.type === "presence") {
          setOnline(data.users);
        } else if (data.type === "typing") {
          showTyping(data.user);
        }
      };

      ws.onclose = (event) => {
        if (stopped) return;
        if (event.code === 1008) {
          setStatus("rejected");
          return;
        }
        setStatus("disconnected");
        const delay = Math.min(1000 * 2 ** attempts, 10000);
        attempts += 1;
        retryTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
      Object.values(timers).forEach(clearTimeout);
    };
  }, [room.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendJson(payload) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    if (sendJson({ type: "message", content })) setText("");
  }

  function handleChange(e) {
    setText(e.target.value);
    const now = Date.now();
    if (now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      sendJson({ type: "typing" });
    }
  }

  let typingText = "";
  if (typingUsers.length === 1) typingText = `${typingUsers[0]} is typing...`;
  else if (typingUsers.length === 2) typingText = `${typingUsers.join(" and ")} are typing...`;
  else if (typingUsers.length > 2) typingText = "Several people are typing...";

  const [statusLabel, statusColor] = STATUS_INFO[status];

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold"># {room.name}</h2>
          <p className="text-xs text-slate-400">
            Online: {online.length > 0 ? online.join(", ") : "-"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} />
          {statusLabel}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-slate-500 text-sm">No messages yet. Say hello!</p>
        )}
        {messages.map((m) => {
          const mine = m.user === user.username;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  mine ? "bg-indigo-600" : "bg-slate-700"
                }`}
              >
                <div className="flex items-baseline gap-2 text-xs text-slate-300">
                  <span className="font-semibold">{mine ? "You" : m.user}</span>
                  <span>{formatTime(m.created_at)}</span>
                </div>
                <p className="break-words whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="h-5 px-6 text-xs text-slate-400">{typingText}</div>

      <form onSubmit={handleSubmit} className="px-6 pb-5 flex gap-3">
        <input
          value={text}
          onChange={handleChange}
          maxLength={2000}
          disabled={status !== "connected"}
          placeholder={status === "connected" ? `Message #${room.name}` : "Connecting..."}
          className="flex-1 rounded-lg bg-slate-700 px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status !== "connected" || !text.trim()}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2 font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}