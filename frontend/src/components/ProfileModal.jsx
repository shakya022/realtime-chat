import { useEffect, useRef, useState } from "react";
import { avatarUrl, updateProfile } from "../api";
import Avatar from "./Avatar";

const AVATAR_SIZE = 128;
const MAX_FILE_MB = 8;

// Crops the picture to a square, shrinks it to 128x128 and returns a JPEG data URL
function fileToAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      reject(new Error(`Image is too big (max ${MAX_FILE_MB} MB).`));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // transparent PNGs would turn black as JPEG
      ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

export default function ProfileModal({ user, onClose, onSaved }) {
  const [username, setUsername] = useState(user.username);
  const [about, setAbout] = useState(user.about || "");
  const [avatar, setAvatar] = useState(null); // null = unchanged, "" = remove, else new image
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  let previewSrc = null;
  if (avatar) previewSrc = avatar;
  else if (avatar === null) previewSrc = avatarUrl(user.id, user.avatar_version);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      setAvatar(await fileToAvatar(file));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const changes = {};
    const newName = username.trim();
    const newAbout = about.trim();
    if (newName !== user.username) changes.username = newName;
    if (newAbout !== (user.about || "")) changes.about = newAbout;
    if (avatar !== null) changes.avatar = avatar;

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile(changes);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-slate-800 rounded-xl p-6 shadow-xl space-y-4 text-white"
      >
        <h2 className="text-xl font-bold">Your profile</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="Profile preview"
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <Avatar
              username={username.trim() || user.username}
              userId={user.id}
              version={0}
              size={96}
            />
          )}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="block rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-sm"
            >
              Change photo
            </button>
            {previewSrc && (
              <button
                type="button"
                onClick={() => setAvatar("")}
                className="block text-sm text-red-300 hover:text-red-200"
              >
                Remove photo
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="profile-username" className="text-sm text-slate-300">
            Username
          </label>
          <input
            id="profile-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_]+"
            title="Letters, numbers and underscores only"
            className="w-full rounded-lg bg-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="profile-about" className="text-sm text-slate-300">
            About
          </label>
          <textarea
            id="profile-about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Tell people a little about yourself"
            className="w-full rounded-lg bg-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <p className="text-xs text-slate-500 text-right">{about.length}/200</p>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2 text-sm font-medium"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}