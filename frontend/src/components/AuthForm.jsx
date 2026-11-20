import { useState } from "react";
import { loginUser, registerUser, setToken } from "../api";

export default function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const action = isLogin ? loginUser : registerUser;
      const data = await action(username.trim(), password);
      setToken(data.access_token);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(isLogin ? "register" : "login");
    setError("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-800 rounded-xl p-8 shadow-xl space-y-5"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin ? "Sign in to join the chat." : "Pick a username to get started."}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="username" className="text-sm text-slate-300">
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
            className="w-full rounded-lg bg-slate-700 text-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-slate-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={8}
            maxLength={72}
            className="w-full rounded-lg bg-slate-700 text-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {!isLogin && (
            <p className="text-xs text-slate-500">At least 8 characters.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2 transition-colors"
        >
          {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
        </button>

        <p className="text-center text-sm text-slate-400">
          {isLogin ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={switchMode}
            className="text-indigo-400 hover:text-indigo-300 font-medium"
          >
            {isLogin ? "Register" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}