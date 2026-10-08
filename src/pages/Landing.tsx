import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth.tsx";
import { ThemeMenu } from "../lib/theme.tsx";

type Mode = "login" | "signup";

export default function Landing() {
  const [mode, setMode] = useState<Mode | null>(null);

  return (
    <div className="landing">
      <header className="landing-bar">
        <div className="logo">
          <span className="logo-mark">🚀</span> dream2role
        </div>
        <nav>
          <ThemeMenu />
          <button className="btn btn-ghost" onClick={() => setMode("login")}>Log in</button>
          <button className="btn btn-green" onClick={() => setMode("signup")}>Sign up</button>
        </nav>
      </header>

      <main className="hero">
        <div className="hero-copy">
          <div className="mascot-big" aria-hidden>
            <span className="bob">🚀</span>
          </div>
          <h1>
            Turn your dream job into a <span className="hl">clear, achievable plan</span>.
          </h1>
          <p className="lead">
            Tell us where you want to go and how much time you have. Dream2Role builds a personalised roadmap with levels, progress tracking and a
            realistic finish date.
          </p>

          <div className="equation" aria-label="Dream job plus current skills plus time plus deadline equals your roadmap">
            <span className="eq-chip eq-purple">🌟 Dream Job</span>
            <span className="eq-op">+</span>
            <span className="eq-chip eq-blue">🧠 Current Skills</span>
            <span className="eq-op">+</span>
            <span className="eq-chip eq-green">⏱️ Time</span>
            <span className="eq-op">+</span>
            <span className="eq-chip eq-orange">📅 Deadline</span>
            <span className="eq-op">=</span>
            <span className="eq-chip eq-gold">🗺️ Your Roadmap</span>
          </div>

          {!mode && (
            <div className="hero-cta">
              <button className="btn btn-green btn-xl" onClick={() => setMode("signup")}>Get started free</button>
              <button className="btn btn-outline btn-xl" onClick={() => setMode("login")}>I already have an account</button>
            </div>
          )}
        </div>

        {mode && <AuthCard mode={mode} setMode={setMode} />}
      </main>

      <section className="features">
        <Feature emoji="🗺️" title="Levels for every skill" text="Your dream job is split into units and bite-sized lessons. Skip what you already know." />
        <Feature emoji="🔥" title="Streaks & XP" text="Study a little every day, build a streak and level up from Dreamer to Legend." />
        <Feature emoji="⏳" title="A real finish date" text="Based on your current skills and the hours you can give each week." />
        <Feature emoji="👯" title="Friends zone" text="See your friends' weekly progress and keep each other going." />
      </section>
    </div>
  );
}

function Feature({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="feature">
      <div className="feature-emoji">{emoji}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function AuthCard({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const { login, signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") await signup(name, email, password);
      else await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card card" onSubmit={submit}>
      <div className="tabs">
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Sign up</button>
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
      </div>
      <h2>{mode === "signup" ? "Create your profile" : "Welcome back"}</h2>
      {mode === "signup" && (
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      )}
      <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      <input
        className="input"
        type="password"
        placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        minLength={mode === "signup" ? 8 : undefined}
        required
      />
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-blue btn-block" disabled={busy}>
        {busy ? "One sec…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
