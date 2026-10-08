import { useCallback, useEffect, useState } from "react";
import { localDay } from "../../shared/game.ts";
import { api, type FriendCard, type PublicCard } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useToast } from "../lib/toasts.tsx";
import { minutesLabel } from "../lib/format.ts";
import WeekBars from "../components/WeekBars.tsx";

type FriendsData = Awaited<ReturnType<typeof api.friends>>;

export default function Friends() {
  const { setUser } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<FriendsData | null>(null);
  const [suggestions, setSuggestions] = useState<PublicCard[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicCard[]>([]);
  const today = localDay();

  const reload = useCallback(async () => {
    const [f, s, me] = await Promise.all([api.friends(), api.suggestions(), api.me()]);
    setData(f);
    setSuggestions(s.suggestions);
    setUser(me.user);
  }, [setUser]);

  useEffect(() => {
    reload().catch(() => toast({ emoji: "😵", title: "Couldn't load friends" }));
  }, [reload, toast]);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => api.search(q.trim()).then((r) => setResults(r.results)), 250);
    return () => clearTimeout(t);
  }, [q]);

  async function act(fn: () => Promise<unknown>, msg: { emoji: string; title: string }) {
    await fn();
    toast({ ...msg, tone: "purple" });
    await reload();
    if (q.trim().length >= 2) setResults((await api.search(q.trim())).results);
  }

  if (!data) return <div className="splash small">👯</div>;
  const board = [...data.friends, data.me].sort((a, b) => b.week.xp - a.week.xp);

  return (
    <div className="friends">
      <div className="friends-main">
        <h1 className="page-title">👯 Friends Zone</h1>

        {data.incoming.length > 0 && (
          <div className="card panel highlight">
            <h3>💌 Friend requests</h3>
            {data.incoming.map((p) => (
              <div key={p.id} className="person-row">
                <span className="avatar">{p.avatar}</span>
                <div className="person-info">
                  <strong>{p.name}</strong>
                  <small>{p.roleEmoji} {p.roleTitle ?? "Just getting started"}</small>
                </div>
                <button className="btn btn-green btn-sm" onClick={() => act(() => api.accept(p.id), { emoji: "🤝", title: `You and ${p.name.split(" ")[0]} are now friends!` })}>Accept</button>
                <button className="btn btn-ghost btn-sm" onClick={() => act(() => api.decline(p.id), { emoji: "👋", title: "Request declined" })}>Ignore</button>
              </div>
            ))}
          </div>
        )}

        <div className="card panel">
          <div className="panel-head">
            <h3>🏆 This week's leaderboard</h3>
            <span className="muted">Resets Monday</span>
          </div>
          {board.length === 1 && <p className="muted">Add friends to see how you stack up! 👇</p>}
          <ol className="leaderboard">
            {board.map((f, i) => (
              <FriendRow key={f.id} f={f} rank={i + 1} isMe={f.id === data.me.id} today={today} onRemove={f.id === data.me.id ? undefined : () => act(() => api.unfriend(f.id), { emoji: "💔", title: `Removed ${f.name.split(" ")[0]}` })} />
            ))}
          </ol>
        </div>

        {data.outgoing.length > 0 && (
          <div className="card panel">
            <h3>⏳ Waiting for a reply</h3>
            <div className="chips">
              {data.outgoing.map((p) => (
                <span key={p.id} className="pending-chip">{p.avatar} {p.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className="side-col">
        <div className="card panel">
          <h3>🔎 Find friends</h3>
          <input className="input" placeholder="Search by name or exact email" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.map((p) => (
            <div key={p.id} className="person-row">
              <span className="avatar">{p.avatar}</span>
              <div className="person-info">
                <strong>{p.name}</strong>
                <small>{p.roleEmoji} {p.roleTitle ?? "Just getting started"}</small>
              </div>
              {p.status === "none" && <button className="btn btn-blue btn-sm" onClick={() => act(() => api.addFriend(p.id), { emoji: "💌", title: "Request sent!" })}>Add</button>}
              {p.status === "incoming" && <button className="btn btn-green btn-sm" onClick={() => act(() => api.accept(p.id), { emoji: "🤝", title: "Friends now!" })}>Accept</button>}
              {p.status === "requested" && <span className="muted">Sent</span>}
              {p.status === "friend" && <span className="muted">Friends ✓</span>}
            </div>
          ))}
        </div>

        <div className="card panel">
          <h3>✨ People you may know</h3>
          {suggestions.length === 0 && <p className="muted">No suggestions right now. Invite a friend to learn with you!</p>}
          {suggestions.map((p) => (
            <div key={p.id} className="person-row">
              <span className="avatar">{p.avatar}</span>
              <div className="person-info">
                <strong>{p.name}</strong>
                <small>{p.reason}</small>
              </div>
              <button className="btn btn-blue btn-sm" onClick={() => act(() => api.addFriend(p.id), { emoji: "💌", title: `Request sent to ${p.name.split(" ")[0]}` })}>Add</button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function FriendRow({ f, rank, isMe, today, onRemove }: { f: FriendCard; rank: number; isMe: boolean; today: string; onRemove?: () => void }) {
  const goal = f.weeklyGoalMinutes ?? 0;
  const pct = goal ? Math.min(100, (f.week.minutes / goal) * 100) : 0;
  const daily = goal ? Math.round(goal / 7) : 30;
  return (
    <li className={`friend-row ${isMe ? "is-me" : ""}`}>
      <span className={`rank rank-${rank}`}>{rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}</span>
      <span className="avatar avatar-lg">{f.avatar}</span>
      <div className="friend-body">
        <div className="friend-top">
          <strong>{isMe ? `${f.name} (you)` : f.name}</strong>
          <span className="friend-badges">
            <span title="Streak">🔥 {f.streak}</span>
            <span title="Level">⭐ {f.level}</span>
            <span title="XP this week">💎 {f.week.xp}</span>
          </span>
        </div>
        <small className="muted">{f.roleEmoji} {f.roleTitle ?? "No goal yet"} · {f.percentDone}% of the way · {f.levelTitle}</small>
        <div className="friend-progress">
          <div className="bar bar-blue bar-sm"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
          <span className="muted">{minutesLabel(f.week.minutes)}{goal ? ` / ${goal / 60}h` : ""}</span>
        </div>
        <WeekBars days={f.week.days} today={today} goal={daily} />
      </div>
      {onRemove && <button className="icon-btn small" title="Remove friend" aria-label={`Remove ${f.name}`} onClick={onRemove}>✕</button>}
    </li>
  );
}
