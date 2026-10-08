import { useEffect, useState, type ReactNode } from "react";
import { api, type AiResult, type Internship, type Project, type Readiness, type Resume, type ResumeInput } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import ResumeView from "../components/ResumeView.tsx";

type Tab = "internships" | "projects" | "resume";
type CareerData = Awaited<ReturnType<typeof api.career>>;

const DRAFT_KEY = "d2r.resumeDraft";

export default function Career() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("internships");
  const [data, setData] = useState<CareerData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.career().then(setData).catch((e) => setError(e.message));
  }, [user?.progress.passedTests]);

  if (error) return <p className="form-error">{error}</p>;
  if (!data) return <div className="splash small">💼</div>;
  const r = data.readiness;

  return (
    <div className="career">
      <h1 className="page-title">Career hub</h1>
      <p className="muted">
        Your AI career coach. {user!.features.ai ? "" : "(AI isn't connected on the server yet, so you'll see simpler offline suggestions.)"}
      </p>
      <div className="career-progress card panel">
        <div className="panel-head">
          <h3>Level tests passed</h3>
          <span className="muted">{r.passed}/{r.total}</span>
        </div>
        <div className="bar bar-purple"><div className="bar-fill" style={{ width: `${(r.passed / r.total) * 100}%` }} /></div>
      </div>

      <div className="tabs career-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "internships"} className={tab === "internships" ? "active" : ""} onClick={() => setTab("internships")}>
          🎯 Internships {!r.internshipsUnlocked && "🔒"}
        </button>
        <button role="tab" aria-selected={tab === "projects"} className={tab === "projects" ? "active" : ""} onClick={() => setTab("projects")}>
          🛠️ Projects {!r.projectsUnlocked && "🔒"}
        </button>
        <button role="tab" aria-selected={tab === "resume"} className={tab === "resume" ? "active" : ""} onClick={() => setTab("resume")}>
          📄 Resume
        </button>
      </div>

      {tab === "internships" && <InternshipsTab readiness={r} initial={data.cache.internships} />}
      {tab === "projects" && <ProjectsTab readiness={r} initial={data.cache.projects} />}
      {tab === "resume" && <ResumeTab initial={data.cache.resume} />}
    </div>
  );
}

function Locked({ emoji, title, need, have }: { emoji: string; title: string; need: number; have: number }) {
  return (
    <div className="locked-card card">
      <div className="celebrate-emoji">{emoji}</div>
      <h2>{title}</h2>
      <p className="muted">Pass {need} level test{need > 1 ? "s" : ""} to unlock this. You've passed {have}.</p>
      <div className="bar bar-purple"><div className="bar-fill" style={{ width: `${Math.min(100, (have / need) * 100)}%` }} /></div>
    </div>
  );
}

function SourceBadge({ source }: { source: "ai" | "offline" }) {
  return source === "ai" ? <span className="badge-ai">✨ AI generated</span> : <span className="badge-offline">offline suggestions</span>;
}

function useGenerate<T>(initial: AiResult<T> | undefined) {
  const [result, setResult] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(fn: () => Promise<AiResult<T>>) {
    setBusy(true);
    setError("");
    try {
      setResult(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { result, busy, error, run };
}

function Thinking({ text }: { text: string }) {
  return (
    <div className="thinking card">
      <span className="bob">🤖</span> {text}
    </div>
  );
}

function InternshipsTab({ readiness, initial }: { readiness: Readiness; initial?: AiResult<{ internships: Internship[]; tips: string[] }> }) {
  const g = useGenerate(initial);
  if (!readiness.internshipsUnlocked)
    return <Locked emoji="🎯" title="Internship matches" need={readiness.internshipsAt} have={readiness.passed} />;

  return (
    <section>
      <div className="tab-actions">
        <p>Internships you're eligible for right now, based on the levels you've passed.</p>
        <button className="btn btn-green" disabled={g.busy} onClick={() => g.run(api.internships)}>
          {g.result ? "Refresh matches" : "Find my internships"}
        </button>
      </div>
      {g.error && <p className="form-error">{g.error}</p>}
      {g.busy && <Thinking text="Matching your skills to internships…" />}
      {g.result && !g.busy && (
        <>
          <SourceBadge source={g.result.source} />
          <div className="idea-grid">
            {g.result.data.internships.map((it, i) => (
              <article key={i} className="idea card">
                <h3>{it.title}</h3>
                <p className="muted">{it.companyTypes.join(" · ")}</p>
                <p>{it.whyYouFit}</p>
                <TagList label="Highlight" items={it.skillsToHighlight} tone="green" />
                {it.gapsToClose.length > 0 && <TagList label="Close the gap" items={it.gapsToClose} tone="orange" />}
                <div className="search-links">
                  <a href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(it.searchKeywords)}`} target="_blank" rel="noreferrer">LinkedIn</a>
                  <a href={`https://internshala.com/internships/keywords-${encodeURIComponent(it.searchKeywords)}`} target="_blank" rel="noreferrer">Internshala</a>
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(it.searchKeywords + " internship")}`} target="_blank" rel="noreferrer">Google</a>
                </div>
              </article>
            ))}
          </div>
          {g.result.data.tips.length > 0 && (
            <div className="card panel">
              <h3>Application tips</h3>
              <ul>{g.result.data.tips.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TagList({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  return (
    <div className="tag-row">
      <small>{label}:</small>
      {items.map((t) => <span key={t} className={`tag tag-${tone}`}>{t}</span>)}
    </div>
  );
}

function ProjectsTab({ readiness, initial }: { readiness: Readiness; initial?: AiResult<{ projects: Project[] }> }) {
  const g = useGenerate(initial);
  const [interests, setInterests] = useState("");
  if (!readiness.projectsUnlocked) return <Locked emoji="🛠️" title="AI project ideas" need={1} have={readiness.passed} />;

  return (
    <section>
      <div className="tab-actions">
        <input className="input" placeholder="What are you into? (e.g. cricket, music, climate, fintech)" value={interests} maxLength={300} onChange={(e) => setInterests(e.target.value)} />
        <button className="btn btn-green" disabled={g.busy} onClick={() => g.run(() => api.projects(interests))}>
          {g.result ? "New ideas" : "Suggest projects"}
        </button>
      </div>
      {g.error && <p className="form-error">{g.error}</p>}
      {g.busy && <Thinking text="Designing portfolio projects for you…" />}
      {g.result && !g.busy && (
        <>
          <SourceBadge source={g.result.source} />
          {g.result.data.projects.map((p, i) => (
            <article key={i} className="project card">
              <div className="project-head">
                <h3>{p.name}</h3>
                <span className={`tag tag-${p.difficulty === "Beginner" ? "green" : p.difficulty === "Intermediate" ? "blue" : "purple"}`}>{p.difficulty}</span>
                <span className="muted">~{p.estimatedHours}h</span>
              </div>
              <p>{p.pitch}</p>
              <Section title="🧱 Tech stack">
                <div className="stack-grid">
                  {p.techStack.map((t) => (
                    <div key={t.name} className="stack-item"><b>{t.name}</b><small>{t.purpose}</small></div>
                  ))}
                </div>
              </Section>
              <Section title="✨ Features">
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              </Section>
              <Section title="🗺️ Milestones">
                <ol className="milestones">
                  {p.milestones.map((m) => (
                    <li key={m.title}>
                      <b>{m.title}</b>
                      <ul>{m.tasks.map((t) => <li key={t}>{t}</li>)}</ul>
                    </li>
                  ))}
                </ol>
              </Section>
              <Section title="🤖 Build it faster with AI">
                <ul>{p.aiHelpIdeas.map((t) => <li key={t}>{t}</li>)}</ul>
              </Section>
              <p className="portfolio-tip">💼 {p.portfolioTip}</p>
            </article>
          ))}
        </>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="project-section">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

const EMPTY: ResumeInput = { fullName: "", email: "", phone: "", location: "", links: "", targetInternship: "", education: "", experience: "", projects: "", extra: "" };

function readDraft(): Partial<ResumeInput> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function ResumeTab({ initial }: { initial?: AiResult<{ resume: Resume; input: ResumeInput }> }) {
  const { user } = useAuth();
  const g = useGenerate(initial);
  const [form, setForm] = useState<ResumeInput>(() => ({
    ...EMPTY,
    fullName: user!.name,
    email: user!.email,
    targetInternship: `${user!.goal!.roleTitle} Intern`,
    ...initial?.data.input,
    ...readDraft(),
  }));
  const [editing, setEditing] = useState(!initial);

  function set<K extends keyof ResumeInput>(k: K, v: string) {
    const next = { ...form, [k]: v };
    setForm(next);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  async function generate() {
    await g.run(() => api.resume(form));
    setEditing(false);
  }

  if (g.result && !editing && !g.busy) {
    return (
      <section>
        <div className="tab-actions no-print">
          <SourceBadge source={g.result.source} />
          <span className="spacer" />
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>Edit details</button>
          <button className="btn btn-outline btn-sm" onClick={generate}>Regenerate</button>
          <button className="btn btn-green btn-sm" onClick={() => window.print()}>Download PDF</button>
        </div>
        {g.result.data.resume.tips.length > 0 && (
          <div className="card panel no-print resume-tips">
            <h3>Before you send it</h3>
            <ul>{g.result.data.resume.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        )}
        <ResumeView resume={g.result.data.resume} contact={g.result.data.input} />
      </section>
    );
  }

  const field = (k: keyof ResumeInput, label: string, opts: { area?: boolean; placeholder?: string; required?: boolean } = {}) => (
    <label className={`field ${opts.area ? "field-wide" : ""}`}>
      <span>{label}{opts.required && " *"}</span>
      {opts.area ? (
        <textarea className="input" rows={4} value={form[k]} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <input className="input" value={form[k]} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value)} />
      )}
    </label>
  );

  return (
    <section>
      <p>Tell us about yourself and the internship you want. The AI writes a one-page resume in the format that field expects, and adds your Dream2Role skills and certificates.</p>
      <div className="resume-form card panel">
        {field("targetInternship", "Target internship", { required: true, placeholder: "e.g. Frontend Developer Intern at a fintech startup" })}
        {field("fullName", "Full name", { required: true })}
        {field("email", "Email", { required: true })}
        {field("phone", "Phone")}
        {field("location", "City")}
        {field("links", "Links", { placeholder: "GitHub, LinkedIn, portfolio…" })}
        {field("education", "Education", { area: true, required: true, placeholder: "B.Tech Computer Science, XYZ University, 2023–2027, CGPA 8.2" })}
        {field("projects", "Projects", { area: true, placeholder: "One per line: Name: what it does, what you used" })}
        {field("experience", "Experience", { area: true, placeholder: "Jobs, internships, freelance, clubs, volunteering… one per line" })}
        {field("extra", "Anything else", { area: true, placeholder: "Achievements, hackathons, languages…" })}
      </div>
      {g.error && <p className="form-error">{g.error}</p>}
      {g.busy ? (
        <Thinking text="Writing your resume…" />
      ) : (
        <div className="tab-actions">
          {g.result && <button className="btn btn-ghost" onClick={() => setEditing(false)}>Back to resume</button>}
          <button className="btn btn-green btn-xl" onClick={generate} disabled={!form.fullName.trim() || !form.targetInternship.trim() || !form.education.trim()}>
            ✨ Build my resume
          </button>
        </div>
      )}
    </section>
  );
}
