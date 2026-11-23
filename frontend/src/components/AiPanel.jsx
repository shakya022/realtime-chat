import { useState } from "react";
import { aiAssist, aiSmartReplies, aiSummary, aiTone, updateProfile } from "../api";

const TONES = [
  ["friendly", "Friendly"],
  ["professional", "Professional"],
  ["romantic", "Romantic"],
  ["cute", "Cute"],
  ["funny", "Funny"],
  ["polite", "Polite"],
  ["casual", "Casual"],
];

const TOOLS = [
  ["fix", "Fix grammar"],
  ["clarify", "Make clearer"],
  ["shorter", "Shorter"],
  ["longer", "More detailed"],
];

const LANGUAGES = [
  "English", "Sinhala", "Tamil", "Hindi", "French",
  "Spanish", "German", "Japanese", "Korean", "Chinese",
];

const chip =
  "rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 px-3 py-1.5 text-sm text-fuchsia-100 disabled:opacity-50 transition-colors";
const actionBtn =
  "rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 py-1.5 text-sm transition-colors";
const dateInput =
  "rounded-lg bg-slate-700 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-fuchsia-400 [color-scheme:dark]";

function tabClass(active) {
  return `flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
    active
      ? "text-white border-fuchsia-400"
      : "text-slate-400 border-transparent hover:text-slate-200"
  }`;
}

function AiBadge({ children }) {
  return (
    <span className="text-[11px] uppercase tracking-wide text-fuchsia-300">
      ✨ AI · {children}
    </span>
  );
}

function Shell({ onClose, children }) {
  return (
    <div className="absolute bottom-24 left-4 right-4 z-20 max-w-2xl max-h-[70vh] overflow-y-auto rounded-2xl border border-fuchsia-400/30 bg-slate-800 shadow-2xl">
      <div className="flex items-center justify-between px-4 pt-3">
        <h3 className="font-semibold">✨ AI assistant</h3>
        <button
          onClick={onClose}
          aria-label="Close AI assistant"
          className="text-slate-400 hover:text-white text-2xl leading-none"
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

function ResultCard({ label, text, onUse, onDismiss }) {
  return (
    <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-3 space-y-2">
      <AiBadge>{label}</AiBadge>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onUse(text)}
          className="rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 px-3 py-1.5 text-sm font-medium"
        >
          Use this
        </button>
        <button onClick={onDismiss} className={actionBtn}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ListBlock({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{title}</p>
      <ul className="list-disc pl-5 space-y-0.5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function AiPanel({ roomId, draft, user, onUserUpdate, onUse, onClose }) {
  const [tab, setTab] = useState("replies");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState(null);
  const [rewritten, setRewritten] = useState(null);
  const [language, setLanguage] = useState("English");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [summary, setSummary] = useState(null);

  const busy = loading !== "";
  const text = draft.trim();
  const hasDraft = text.length > 0;

  async function run(key, fn) {
    setError("");
    setLoading(key);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  const setAiEnabled = (value) =>
    run("enable", async () => {
      onUserUpdate(await updateProfile({ ai_enabled: value }));
    });

  const getReplies = () =>
    run("replies", async () => {
      const data = await aiSmartReplies(roomId);
      setSuggestions(data.suggestions);
    });

  const changeTone = (tone, label) =>
    run(`tone-${tone}`, async () => {
      const data = await aiTone(text, tone);
      setRewritten({ label, text: data.text });
    });

  const assist = (action, label) =>
    run(`assist-${action}`, async () => {
      const data = await aiAssist(text, action, action === "translate" ? language : null);
      setRewritten({ label, text: data.text });
    });

  const getSummary = () =>
    run("summary", async () => {
      setSummary(await aiSummary(roomId, start, end));
    });

  // ----- first use: explain what is sent and ask for permission -----
  if (!user.ai_enabled) {
    return (
      <Shell onClose={onClose}>
        <div className="px-4 pb-4 pt-3 space-y-3 text-sm text-slate-300">
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <p className="font-medium text-white">Turn on AI features?</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              They send text to an AI service (currently Google Gemini) to write the answers.
            </li>
            <li>
              Nothing is sent in the background. It only happens when you press an AI button,
              and the AI never sends a message for you.
            </li>
            <li>
              Smart replies and summaries send recent messages from this chat, including
              messages written by other people.
            </li>
            <li>
              On Google's free tier, prompts and responses may be used to improve Google's
              products. Don't use AI on anything private or sensitive.
            </li>
            <li>BeyondChat messages are not end-to-end encrypted.</li>
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => setAiEnabled(true)}
              disabled={busy}
              className="rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-60 px-4 py-2 font-medium"
            >
              {busy ? "Turning on..." : "Turn on AI"}
            </button>
            <button onClick={onClose} className={actionBtn}>
              Not now
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell onClose={onClose}>
      <div className="flex border-b border-slate-700 mt-2">
        <button className={tabClass(tab === "replies")} onClick={() => setTab("replies")}>
          Replies
        </button>
        <button className={tabClass(tab === "rewrite")} onClick={() => setTab("rewrite")}>
          Rewrite
        </button>
        <button className={tabClass(tab === "summary")} onClick={() => setTab("summary")}>
          Summary
        </button>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {tab === "replies" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Suggests replies based on the latest messages in this chat. Pick one to edit it
              before sending.
            </p>
            <button className={actionBtn} disabled={busy} onClick={getReplies}>
              {loading === "replies"
                ? "Thinking..."
                : suggestions
                  ? "Suggest again"
                  : "Suggest replies"}
            </button>
            {suggestions && (
              <div className="space-y-2">
                <AiBadge>suggested replies</AiBadge>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button key={i} className={chip} onClick={() => onUse(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "rewrite" && (
          <div className="space-y-3">
            {hasDraft ? (
              <p className="text-xs text-slate-400">
                Your message:{" "}
                <span className="text-slate-200 italic">
                  {text.slice(0, 140)}
                  {text.length > 140 ? "..." : ""}
                </span>
              </p>
            ) : (
              <p className="text-sm text-amber-300">
                Type your message in the box below first, then choose a tone or a tool.
              </p>
            )}

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Tone</p>
              <div className="flex flex-wrap gap-2">
                {TONES.map(([value, label]) => (
                  <button
                    key={value}
                    className={chip}
                    disabled={busy || !hasDraft}
                    onClick={() => changeTone(value, label)}
                  >
                    {loading === `tone-${value}` ? "..." : label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">
                Writing tools
              </p>
              <div className="flex flex-wrap gap-2">
                {TOOLS.map(([value, label]) => (
                  <button
                    key={value}
                    className={actionBtn}
                    disabled={busy || !hasDraft}
                    onClick={() => assist(value, label)}
                  >
                    {loading === `assist-${value}` ? "..." : label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="rounded-lg bg-slate-700 px-2 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-fuchsia-400"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  className={actionBtn}
                  disabled={busy || !hasDraft}
                  onClick={() => assist("translate", `Translated to ${language}`)}
                >
                  {loading === "assist-translate" ? "..." : "Translate"}
                </button>
              </div>
            </div>

            {rewritten && (
              <ResultCard
                label={rewritten.label}
                text={rewritten.text}
                onUse={onUse}
                onDismiss={() => setRewritten(null)}
              />
            )}
          </div>
        )}

        {tab === "summary" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Summarizes this chat. Leave the dates empty to use the latest messages, or pick a
              range.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-slate-400 block space-y-1">
                From
                <input
                  type="date"
                  value={start}
                  max={end || undefined}
                  onChange={(e) => setStart(e.target.value)}
                  className={`${dateInput} block`}
                />
              </label>
              <label className="text-xs text-slate-400 block space-y-1">
                To
                <input
                  type="date"
                  value={end}
                  min={start || undefined}
                  onChange={(e) => setEnd(e.target.value)}
                  className={`${dateInput} block`}
                />
              </label>
              <button className={actionBtn} disabled={busy} onClick={getSummary}>
                {loading === "summary" ? "Summarizing..." : "Summarize"}
              </button>
            </div>

            {summary && (
              <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-3 space-y-3">
                <AiBadge>summary</AiBadge>
                <p className="text-sm whitespace-pre-wrap">{summary.summary}</p>
                <ListBlock title="Key points" items={summary.key_points} />
                <ListBlock title="Decisions" items={summary.decisions} />
                <ListBlock title="Deadlines" items={summary.deadlines} />
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setAiEnabled(false)}
          disabled={busy}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Turn off AI features
        </button>
      </div>
    </Shell>
  );
}