import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { askCoach, type ChatMessage } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";

const STORE_KEY = "d2r.coachChat";

function loadChat(): ChatMessage[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveChat(msgs: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-30)));
  } catch {
    /* ignore */
  }
}

/** Floating "Ask Rolo" button that opens a chat with the AI coach. */
export default function CoachChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadChat);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const role = user?.goal?.roleTitle ?? "your dream job";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

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
      {!open && (
        <button className="coach-fab" onClick={() => setOpen(true)} aria-label="Ask Rolo, your AI coach">
          <span className="bob">🚀</span>
          <span className="coach-fab-label">Ask Rolo</span>
        </button>
      )}
      {open && (
        <div className="coach-panel card" role="dialog" aria-label="AI coach">
          <header className="coach-head">
            <span className="coach-avatar">🚀</span>
            <div>
              <strong>Rolo</strong>
              <small>Your AI career coach</small>
            </div>
            <span className="spacer" />
            {messages.length > 0 && (
              <button className="icon-btn small" title="New chat" aria-label="New chat" onClick={() => { setMessages([]); saveChat([]); }}>🗑️</button>
            )}
            <button className="icon-btn small" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
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
            <input className="input" placeholder="Ask Rolo…" value={input} maxLength={2000} onChange={(e) => setInput(e.target.value)} autoFocus />
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
