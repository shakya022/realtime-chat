export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export const WS_URL = API_URL.replace(/^http/, "ws");

const TOKEN_KEY = "chat_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Returns null when the user has no photo (version 0)
export const avatarUrl = (userId, version) =>
  version ? `${API_URL}/users/${userId}/avatar?v=${version}` : null;

function formatError(data, status) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    const field = first.loc?.[first.loc.length - 1];
    return field ? `${field}: ${first.msg}` : first.msg;
  }
  return `Request failed (${status})`;
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(formatError(data, res.status));
    error.status = res.status;
    throw error;
  }
  return data;
}

// ---------- account ----------
export const registerUser = (username, password) =>
  request("/auth/register", { method: "POST", body: { username, password } });

export const loginUser = (username, password) =>
  request("/auth/login", { method: "POST", body: { username, password } });

export const getMe = () => request("/auth/me", { auth: true });

export const updateProfile = (changes) =>
  request("/users/me", { method: "PATCH", body: changes, auth: true });

// ---------- people and friends ----------
export const searchUsers = (q) =>
  request(`/users/search?q=${encodeURIComponent(q)}`, { auth: true });

export const listFriends = () => request("/friends", { auth: true });

export const listRequests = () => request("/friends/requests", { auth: true });

export const sendFriendRequest = (userId) =>
  request("/friends/requests", { method: "POST", body: { user_id: userId }, auth: true });

export const acceptRequest = (requestId) =>
  request(`/friends/requests/${requestId}/accept`, { method: "POST", auth: true });

export const removeRequest = (requestId) =>
  request(`/friends/requests/${requestId}`, { method: "DELETE", auth: true });

export const unfriend = (userId) =>
  request(`/friends/${userId}`, { method: "DELETE", auth: true });

// ---------- chats ----------
export const listRooms = () => request("/rooms", { auth: true });

export const createRoom = (name) =>
  request("/rooms", { method: "POST", body: { name }, auth: true });

export const joinGroup = (code) =>
  request("/rooms/join", { method: "POST", body: { code }, auth: true });

export const openDm = (userId) =>
  request("/dms", { method: "POST", body: { user_id: userId }, auth: true });

export const listMembers = (roomId) => request(`/rooms/${roomId}/members`, { auth: true });

export const addMember = (roomId, userId) =>
  request(`/rooms/${roomId}/members`, { method: "POST", body: { user_id: userId }, auth: true });

export const leaveGroup = (roomId) =>
  request(`/rooms/${roomId}/members/me`, { method: "DELETE", auth: true });

export const resetInviteCode = (roomId) =>
  request(`/rooms/${roomId}/invite/reset`, { method: "POST", auth: true });

// ---------- AI ----------
export const aiSmartReplies = (roomId) =>
  request("/ai/smart-replies", { method: "POST", body: { room_id: roomId }, auth: true });

export const aiTone = (text, tone) =>
  request("/ai/tone", { method: "POST", body: { text, tone }, auth: true });

export const aiAssist = (text, action, language) =>
  request("/ai/assist", { method: "POST", body: { text, action, language }, auth: true });

export const aiSummary = (roomId, start, end) =>
  request("/ai/summary", {
    method: "POST",
    body: { room_id: roomId, start: start || null, end: end || null },
    auth: true,
  });