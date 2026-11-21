import { useState } from "react";
import { avatarUrl } from "../api";

const COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

function colorFor(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[hash % COLORS.length];
}

// Shows the user's photo, or a coloured circle with their first letter
export default function Avatar({ username, userId, version, size = 36 }) {
  const [failedVersion, setFailedVersion] = useState(null);
  const src = avatarUrl(userId, version);
  const style = { width: size, height: size, fontSize: size * 0.42 };

  if (src && failedVersion !== version) {
    return (
      <img
        src={src}
        alt={username}
        style={style}
        className="rounded-full object-cover shrink-0"
        onError={() => setFailedVersion(version)}
      />
    );
  }

  return (
    <div
      style={style}
      className={`${colorFor(username)} rounded-full flex items-center justify-center font-semibold text-white shrink-0 select-none`}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}