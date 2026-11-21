export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export const WS_URL = API_URL.replace(/^http/, "ws");

const TOKEN_KEY = "chat_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

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

export const registerUser = (username, password) =>
  request("/auth/register", { method: "POST", body: { username, password } });

export const loginUser = (username, password) =>
  request("/auth/login", { method: "POST", body: { username, password } });

export const getMe = () => request("/auth/me", { auth: true });

export const listRooms = () => request("/rooms", { auth: true });

export const createRoom = (name) =>
  request("/rooms", { method: "POST", body: { name }, auth: true });