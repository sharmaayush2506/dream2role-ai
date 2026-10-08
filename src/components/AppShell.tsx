import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { levelInfo, liveStreak, localDay } from "../../shared/game.ts";
import { roleForGoal } from "../../shared/plan.ts";
import { useAuth } from "../lib/auth.tsx";
import { useToast } from "../lib/toasts.tsx";
import { useReminders } from "../lib/useReminders.ts";
import SuggestionPopup from "./SuggestionPopup.tsx";
import CertSidebar from "./CertSidebar.tsx";
import CoachChat from "./CoachChat.tsx";
import Icon from "./Icon.tsx";
import Logo from "./Logo.tsx";
import { ThemeMenu } from "../lib/theme.tsx";
import { useMediaQuery } from "../lib/useMediaQuery.ts";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const me = user!;
  const role = roleForGoal(me.goal!);
  const lvl = levelInfo(me.progress.xp);
  const streak = liveStreak(me.progress, localDay());
  const { reminders, prefs, enable, disable, setTime } = useReminders(me);
  const [bellOpen, setBellOpen] = useState(false);
  const [certsOpen, setCertsOpen] = useState(false);
  const shown = useRef(false);
  const wide = useMediaQuery("(min-width: 721px)");

  // Greet with the most relevant nudge once per browser session.
  useEffect(() => {
    if (shown.current || !reminders.length) return;
    shown.current = true;
    try {
      const key = `d2r.greeted.${localDay()}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    const r = reminders[0];
    setTimeout(() => toast({ emoji: r.emoji, title: r.title, body: r.body, tone: "orange" }), 600);
  }, [reminders, toast]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo size={30} className="sidebar-logo" />
        <NavLink to="/learn" className="nav-item" aria-label="Learn">
          <Icon name="home" /> <span className="nav-label">Learn</span>
        </NavLink>
        <NavLink to="/friends" className="nav-item" aria-label="Friends">
          <Icon name="users" /> <span className="nav-label">Friends</span>
          {me.incomingCount > 0 && <span className="nav-badge">{me.incomingCount}</span>}
        </NavLink>
        <NavLink to="/career" className="nav-item" aria-label="Career">
          <Icon name="briefcase" /> <span className="nav-label">Career</span>
        </NavLink>
        <button className={`nav-item ${certsOpen ? "active" : ""}`} aria-label="Certificates" onClick={() => setCertsOpen(true)}>
          <Icon name="award" /> <span className="nav-label">Certificates</span>
          {me.certificates.length > 0 && <span className="nav-badge nav-badge-gold">{me.certificates.length}</span>}
        </button>
        <button className="nav-item" aria-label="My plan" onClick={() => navigate("/setup")}>
          <Icon name="target" /> <span className="nav-label">My plan</span>
        </button>
        {wide && <CoachChat variant="docked" />}
        <button className="nav-item nav-logout" aria-label="Log out" onClick={logout}>
          <Icon name="logout" /> <span className="nav-label">Log out</span>
        </button>
      </aside>

      <div className="main">
        <header className="hud">
          <div className="hud-role" title={role.title}>
            <span>{role.emoji}</span> <span className="hud-role-text">{role.title}</span>
          </div>
          <div className="hud-stats">
            <span className={`hud-stat ${streak ? "hud-streak" : "hud-muted"}`} title="Day streak"><Icon name="flame" size={17} /> {streak}</span>
            <span className="hud-stat hud-xp" title="Total XP"><Icon name="gem" size={17} /> {me.progress.xp}</span>
            <span className="hud-stat hud-level" title={`Level ${lvl.level}: ${lvl.title}`}><Icon name="star" size={17} /> {lvl.level}</span>
            <ThemeMenu />
            <div className="bell-wrap">
              <button className="hud-stat bell" aria-label="Reminders" aria-expanded={bellOpen} onClick={() => setBellOpen(!bellOpen)}>
                <Icon name="bell" size={18} />
                {reminders.length > 0 && <span className="bell-dot" />}
              </button>
              {bellOpen && (
                <div className="bell-panel card">
                  <h4>Reminders</h4>
                  {reminders.length === 0 && <p className="muted">All caught up! 🎉</p>}
                  {reminders.map((r) => (
                    <div key={r.id} className="reminder">
                      <span>{r.emoji}</span>
                      <div>
                        <strong>{r.title}</strong>
                        <p>{r.body}</p>
                      </div>
                    </div>
                  ))}
                  <div className="reminder-settings">
                    <label>
                      Daily nudge at{" "}
                      <input type="time" className="input input-sm" value={prefs.time} onChange={(e) => setTime(e.target.value)} />
                    </label>
                    {prefs.enabled ? (
                      <button className="btn btn-ghost btn-sm" onClick={disable}>Turn off</button>
                    ) : (
                      <button
                        className="btn btn-blue btn-sm"
                        onClick={async () => {
                          const perm = await enable(prefs.time);
                          if (perm === "denied") toast({ emoji: "🙈", title: "Notifications are blocked", body: "Allow them in your browser settings to get nudges." });
                          else toast({ emoji: "🔔", title: "Nudges on!", body: `We'll poke you at ${prefs.time} if you haven't studied.`, tone: "green" });
                        }}
                      >
                        Turn on
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
      <SuggestionPopup />
      {!wide && <CoachChat />}
      {certsOpen && <CertSidebar onClose={() => setCertsOpen(false)} />}
    </div>
  );
}
