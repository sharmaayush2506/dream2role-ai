import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { askCoach, type ChatMessage } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { RocketMark } from "./Logo.tsx";

const STORE_KEY = "d2r.coachChat";

function loadChat(): ChatMessage[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const DOCK_KEY = "d2r.coachDock";

function loadDockOpen(): boolean {
  try {
    return localStorage.getItem(DOCK_KEY) !== "closed";
  } catch {
    return true;
  }
}

function saveDockOpen(open: boolean) {
  try {
    localStorage.setItem(DOCK_KEY, open ? "open" : "closed");
  } catch {
    /* ignore */
  }
}

function saveChat(msgs: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-30)));
  } catch {
    /* ignore */
  }
}

/**
 * Chat with Rolo, the AI coach. "docked" fills the sidebar like an editor's chat panel and can be
 * minimised; "floating" is an "Ask Rolo" button that opens a pop-up (used on phones).
 */
export default function CoachChat({ variant = "floating" }: { variant?: "docked" | "floating" }) {
  const { user } = useAuth();
  const docked = variant === "docked";
  const [open, setOpen] = useState(() => (docked ? loadDockOpen() : false));
  const [messages, setMessages] = useState<ChatMessage[]>(loadChat);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const role = user?.goal?.roleTitle ?? "your dream job";

  useEffect(() => {
    endRef.current?.parentElement?.scrollTo({ top: endRef.current.parentElement.scrollHeight });
  }, [messages, open]);

  function toggle(next: boolean) {
    setOpen(next);
    if (docked) saveDockOpen(next);
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const reply = await askCoach(history, (soFar) => setMessages([...history, { role: "assistant", content: soFar }]));
      const done: ChatMessage[] = [...history, { role: "assistant", content: reply }];
      setMessages(done);
      saveChat(done);
    } catch (e) {
      setMessages(history);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const starters = [
    "What should I study today?",
    "Explain my next lesson simply",
    "How do I prepare for my level test?",
    `What projects help me get hired as a ${role}?`,
  ];

  return (
    <>
      {!open && !docked && (
        <button className="coach-fab" onClick={() => toggle(true)} aria-label="Ask Rolo, your AI coach">
          <RocketMark size={28} />
          <span className="coach-fab-label">Ask Rolo</span>
        </button>
      )}
      {!open && docked && (
        <button className="coach-dock-bar" onClick={() => toggle(true)} aria-label="Open Rolo, your AI coach">
          <RocketMark size={26} />
          <span>
            <strong>Ask Rolo</strong>
            <small>Your AI career coach</small>
          </span>
          <span className="coach-dock-chevron" aria-hidden="true">▴</span>
        </button>
      )}
      {open && (
        <div className={docked ? "coach-dock" : "coach-panel card"} role={docked ? "region" : "dialog"} aria-label="AI coach">
          <header className="coach-head">
            <RocketMark size={docked ? 30 : 36} />
            <div>
              <strong>Rolo</strong>
              <small>Your AI career coach</small>
            </div>
            <span className="spacer" />
            {messages.length > 0 && (
              <button className="icon-btn small" title="New chat" aria-label="New chat" onClick={() => { setMessages([]); saveChat([]); }}>🗑️</button>
            )}
            <button className="icon-btn small" title={docked ? "Minimise" : "Close"} aria-label={docked ? "Minimise Rolo" : "Close"} onClick={() => toggle(false)}>
              {docked ? "▾" : "✕"}
            </button>
          </header>

          <div className="coach-body">
            {messages.length === 0 && (
              <div className="coach-welcome">
                <p>Hi {user?.name.split(" ")[0]}! 👋 I know your plan and progress. Ask me anything about becoming a <b>{role}</b>.</p>
                <div className="coach-starters">
                  {starters.map((s) => (
                    <button key={s} className="level-chip" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`bubble bubble-${m.role}`}>
                {m.content ? <FormattedText text={m.content} /> : <span className="typing"><i /><i /><i /></span>}
              </div>
            ))}
            {error && <p className="form-error">{error}</p>}
            <div ref={endRef} />
          </div>

          <form className="coach-input" onSubmit={submit}>
            <input className="input" placeholder="Ask Rolo…" value={input} maxLength={2000} onChange={(e) => setInput(e.target.value)} autoFocus={!docked} />
            <button className="btn btn-green btn-sm" disabled={busy || !input.trim()}>Send</button>
          </form>
        </div>
      )}
    </>
  );
}

/** Light formatting for chat replies: paragraphs, bullet/numbered lists and **bold**. */
function FormattedText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{bold(l)}</li>)}</ul>);
    list = [];
  };
  for (const line of text.split("\n")) {
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (item) list.push(item[1]);
    else {
      flush();
      if (line.trim()) blocks.push(<p key={blocks.length}>{bold(line)}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

function bold(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part,
  );
}
