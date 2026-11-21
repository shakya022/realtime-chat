import { useCallback, useEffect, useState } from "react";
import AuthForm from "./components/AuthForm";
import Chat from "./components/Chat";
import { clearToken, getMe, getToken } from "./api";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  // On page load, check whether a saved token is still valid
  useEffect(() => {
    if (!getToken()) return;
    getMe()
      .then(setUser)
      .catch((err) => {
        if (err.status === 401) clearToken();
      })
      .finally(() => setChecking(false));
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuth={setUser} />;
  }

  return <Chat user={user} onLogout={handleLogout} onUserUpdate={setUser} />;
}