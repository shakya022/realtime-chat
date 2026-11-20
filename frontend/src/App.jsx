import { useEffect, useState } from "react";
import AuthForm from "./components/AuthForm";
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

  function handleLogout() {
    clearToken();
    setUser(null);
  }

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

  // Temporary screen. The room list and chat come in the next step.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900 text-white">
      <h1 className="text-2xl font-bold">Signed in as {user.username}</h1>
      <button
        onClick={handleLogout}
        className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2"
      >
        Log out
      </button>
    </div>
  );
}