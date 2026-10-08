import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROLES, findRole } from "../../shared/catalog.ts";
import { LEVEL_LABELS, addDays, buildPath, daysBetween, estimate, type Goal, type SkillLevel } from "../../shared/plan.ts";
import { localDay } from "../../shared/game.ts";
import { api } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { formatDate, plural } from "../lib/format.ts";
import { ThemeMenu } from "../lib/theme.tsx";
import { RocketMark } from "../components/Logo.tsx";
import AiThinking, { type Stage } from "../components/AiThinking.tsx";

const STEPS = ["Dream job", "Current skills", "Time", "Deadline", "Your plan"] as const;

const TIME_PRESETS = [
  { hours: 3, label: "Casual", emoji: "🐢" },
  { hours: 6, label: "Regular", emoji: "🚶" },
  { hours: 10, label: "Serious", emoji: "🏃" },
  { hours: 20, label: "Intense", emoji: "🚀" },
];

export default function Setup() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const existing = user!.goal;
  const today = localDay();

  const [step, setStep] = useState(0);
  const [roleId, setRoleId] = useState(existing?.roleId ?? "");
  const [customTitle, setCustomTitle] = useState(existing?.roleId === "custom" ? existing.roleTitle : "");
  const [levels, setLevels] = useState<Record<string, SkillLevel>>(existing?.levels ?? {});
  const [hoursPerWeek, setHoursPerWeek] = useState(existing?.hoursPerWeek ?? 6);
  const [deadline, setDeadline] = useState<string | null>(existing?.deadline ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // "Generate my roadmap": the running save + AI insight, while the thinking screen shows.
  const [generating, setGenerating] = useState<{ work: Promise<unknown>; stages: Stage[] } | null>(null);
  const [savedGoal, setSavedGoal] = useState("");
  const [insight, setInsight] = useState<{ headline: string; focus: string; tips: string[] } | null>(null);

  const role = roleId ? findRole(roleId, customTitle) : null;
  const goal: Goal | null = role
    ? { roleId: role.id, roleTitle: role.title, levels, hoursPerWeek, deadline, createdAt: "" }
    : null;
  // Progress only carries over when the dream job stays the same.
  const lessonMinutes = existing && existing.roleId === roleId ? user!.progress.lessonMinutes : {};
  const est = useMemo(() => (goal ? estimate(goal, lessonMinutes, today) : null), [JSON.stringify(goal), today]);

  const canNext =
    (step === 0 && !!roleId && (roleId !== "custom" || customTitle.trim().length > 1)) ||
    step === 1 ||
    step === 2 ||
    (step === 3 && (!deadline || deadline > today));

  const goalKey = goal ? JSON.stringify({ ...goal, createdAt: "" }) : "";

  /** Saves the plan and asks the AI for an insight, behind the "AI thinking" screen. */
  function generate() {
    if (!goal || !role || !est) return;
    setError("");
    setInsight(null);
    const path = buildPath(goal);
    const lessons = path.flatMap((u) => u.lessons);
    const skipped = lessons.filter((l) => l.placedOut).length;
    const stages: Stage[] = [
      { label: "Analyzing your target role...", done: "Role requirements", detail: `${role.skills.length} core skills for ${role.title}` },
      {
        label: "Mapping skill dependencies...",
        done: "Skill graph",
        detail: `${lessons.length} lessons in ${path.length} levels${skipped ? ` · ${skipped} you can skip` : ""}`,
      },
      {
        label: "Finding realistic milestones...",
        done: "Career paths",
        detail: `${plural(est.weeksNeeded, "week")} at ${hoursPerWeek} h/week · finish ${formatDate(est.finishDate)}`,
      },
      { label: "Building your roadmap...", done: "Roadmap built" },
    ];
    const key = goalKey;
    const work = (async () => {
      const { user } = await api.saveGoal(goal);
      setSavedGoal(key);
      // The AI insight is a bonus: never block the roadmap on it.
      const ai = await api.planInsight().catch(() => null);
      if (ai?.source === "ai" && ai.data) setInsight(ai.data);
      setUser(user);
    })();
    setGenerating({ work, stages });
  }

  async function startLearning() {
    if (!goal) return;
    setSaving(true);
    setError("");
    try {
      // Save again only if the plan was tweaked on this screen (e.g. "Use 11 h / week").
      if (goalKey !== savedGoal) setUser((await api.saveGoal(goal)).user);
      navigate("/learn", { state: { fresh: true } });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="setup">
      <div className="setup-top">
        <button
          className="icon-btn"
          aria-label={step === 0 ? "Close" : "Back"}
          onClick={() => (step === 0 ? (existing ? navigate("/learn") : undefined) : setStep(step - 1))}
          disabled={step === 0 && !existing}
        >
          {step === 0 ? "✕" : "←"}
        </button>
        <div className="bar bar-lg" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          <div className="bar-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <span className="setup-step">{step + 1}/{STEPS.length}</span>
        <ThemeMenu />
      </div>

      <div className="setup-body">
        {step === 0 && (
          <section>
            <Bubble>Hi {user!.name.split(" ")[0]}! What's your <b>dream job</b>?</Bubble>
            <div className="role-grid">
              {ROLES.map((r) => (
                <button key={r.id} className={`role-card ${roleId === r.id ? "selected" : ""}`} onClick={() => setRoleId(r.id)}>
                  <span className="role-emoji">{r.emoji}</span>
                  <strong>{r.title}</strong>
                  <small>{r.blurb}</small>
                </button>
              ))}
              <button className={`role-card ${roleId === "custom" ? "selected" : ""}`} onClick={() => setRoleId("custom")}>
                <span className="role-emoji">🌟</span>
                <strong>Something else</strong>
                {roleId === "custom" ? (
                  <input
                    className="input"
                    autoFocus
                    placeholder="e.g. Game Designer"
                    value={customTitle}
                    maxLength={60}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <small>Type your own dream job</small>
                )}
              </button>
            </div>
          </section>
        )}

        {step === 1 && role && (
          <section>
            <Bubble>How well do you know these <b>{role.title}</b> skills already? Be honest, you'll skip ahead on what you know!</Bubble>
            <div className="skill-levels">
              {role.skills.map((s) => (
                <div key={s.id} className="skill-level-row card">
                  <div className="skill-name">
                    <span className="skill-icon">{s.icon}</span>
                    <div>
                      <strong>{s.name}</strong>
                      <small>{s.topics.length} lessons · ~{s.hours}h from scratch</small>
                    </div>
                  </div>
                  <div className="level-chips" role="radiogroup" aria-label={`${s.name} level`}>
                    {([0, 1, 2, 3] as SkillLevel[]).map((lv) => (
                      <button
                        key={lv}
                        role="radio"
                        aria-checked={(levels[s.id] ?? 0) === lv}
                        className={`level-chip ${(levels[s.id] ?? 0) === lv ? "selected" : ""}`}
                        onClick={() => setLevels({ ...levels, [s.id]: lv })}
                        title={LEVEL_LABELS[lv].hint}
                      >
                        <span>{LEVEL_LABELS[lv].emoji}</span>
                        {LEVEL_LABELS[lv].label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <Bubble>How much <b>time</b> can you give each week?</Bubble>
            <div className="preset-grid">
              {TIME_PRESETS.map((p) => (
                <button key={p.hours} className={`preset ${hoursPerWeek === p.hours ? "selected" : ""}`} onClick={() => setHoursPerWeek(p.hours)}>
                  <span className="preset-emoji">{p.emoji}</span>
                  <strong>{p.label}</strong>
                  <small>{p.hours} h / week</small>
                </button>
              ))}
            </div>
            <div className="slider-card card">
              <label htmlFor="hpw">
                Or fine-tune: <b>{hoursPerWeek} hours a week</b> ≈ {Math.round((hoursPerWeek * 60) / 7)} min a day
              </label>
              <input id="hpw" type="range" min={1} max={40} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} />
            </div>
            {est && <LiveEstimate weeks={est.weeksNeeded} hours={est.remainingHours} />}
          </section>
        )}

        {step === 3 && (
          <section>
            <Bubble>Do you have a <b>deadline</b> in mind? (An interview, graduation, new year's resolution…)</Bubble>
            <div className="preset-grid">
              {[
                { label: "3 months", days: 91, emoji: "⚡" },
                { label: "6 months", days: 182, emoji: "🌓" },
                { label: "1 year", days: 365, emoji: "🗓️" },
              ].map((p) => {
                const d = addDays(today, p.days);
                return (
                  <button key={p.label} className={`preset ${deadline === d ? "selected" : ""}`} onClick={() => setDeadline(d)}>
                    <span className="preset-emoji">{p.emoji}</span>
                    <strong>{p.label}</strong>
                    <small>{formatDate(d)}</small>
                  </button>
                );
              })}
              <button className={`preset ${deadline === null ? "selected" : ""}`} onClick={() => setDeadline(null)}>
                <span className="preset-emoji">🌈</span>
                <strong>No deadline</strong>
                <small>At my own pace</small>
              </button>
            </div>
            <div className="slider-card card">
              <label htmlFor="deadline">Or pick an exact date</label>
              <input id="deadline" className="input" type="date" min={addDays(today, 7)} value={deadline ?? ""} onChange={(e) => setDeadline(e.target.value || null)} />
            </div>
            {est && <LiveEstimate weeks={est.weeksNeeded} hours={est.remainingHours} />}
            {error && <p className="form-error">{error}</p>}
          </section>
        )}

        {step === 4 && est && role && (
          <section className="result">
            <div className="result-hero">
              <span className="result-emoji bob">{role.emoji}</span>
              <h2>Your road to {role.title}</h2>
            </div>
            <div className="result-stats">
              <Stat big={`${est.remainingHours}h`} label="of learning to go" sub={est.totalHours > est.remainingHours ? `You skip ${Math.round(est.totalHours - est.remainingHours)}h thanks to what you know 🎉` : undefined} />
              <Stat big={plural(est.weeksNeeded, "week")} label={`at ${hoursPerWeek} h / week`} />
              <Stat big={formatDate(est.finishDate)} label="estimated finish line 🏁" />
            </div>
            {est.deadline && (
              <div className={`verdict ${est.onTrack ? "verdict-good" : "verdict-warn"}`}>
                {est.onTrack ? (
                  <>
                    <b>✅ You'll make your deadline</b> of {formatDate(est.deadline)} with time to spare.
                  </>
                ) : (
                  <>
                    <b>⚠️ That's {lateBy(est.deadline, est.finishDate)} past your deadline.</b> To finish by {formatDate(est.deadline)},
                    aim for <b>{est.hoursPerWeekForDeadline} h / week</b>.
                    <button className="btn btn-orange btn-sm" onClick={() => setHoursPerWeek(Math.min(80, est.hoursPerWeekForDeadline!))}>
                      Use {est.hoursPerWeekForDeadline} h / week
                    </button>
                  </>
                )}
              </div>
            )}
            {insight && (
              <div className="insight card">
                <div className="insight-head">
                  <span className="ai-spark">✦</span> AI insight
                </div>
                <h3>{insight.headline}</h3>
                <p className="insight-focus">{insight.focus}</p>
                <ul>{insight.tips.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            )}
            <RoadmapGraph goal={goal!} finish={formatDate(est.finishDate)} />
            {error && <p className="form-error">{error}</p>}
          </section>
        )}
      </div>

      <footer className="setup-footer">
        {step < 3 ? (
          <button className="btn btn-green btn-xl" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Continue
          </button>
        ) : step === 3 ? (
          <button className="btn btn-green btn-xl" disabled={!canNext || !!generating} onClick={generate}>
            ✦ Generate my roadmap
          </button>
        ) : (
          <button className="btn btn-green btn-xl" disabled={saving} onClick={startLearning}>
            {saving ? "Saving…" : "Start learning →"}
          </button>
        )}
      </footer>

      {generating && (
        <AiThinking
          stages={generating.stages}
          work={generating.work}
          onDone={() => {
            setGenerating(null);
            setStep(4);
          }}
          onError={(msg) => {
            setGenerating(null);
            setError(msg);
          }}
        />
      )}
    </div>
  );
}

/** The roadmap as a connected path of levels; each level draws in after the previous one. */
function RoadmapGraph({ goal, finish }: { goal: Goal; finish: string }) {
  const path = buildPath(goal);
  return (
    <ol className="roadmap-graph" aria-label="Your roadmap">
      {path.map((u, i) => {
        const left = u.lessons.reduce((s, l) => s + (l.placedOut ? 0 : l.minutes), 0);
        const level = LEVEL_LABELS[goal.levels[u.skill.id] ?? 0];
        return (
          <li key={u.skill.id} className="rg-item" style={{ "--i": i } as React.CSSProperties}>
            <span className="rg-node">{u.skill.icon}</span>
            <div className="rg-body">
              <small>Level {i + 1}</small>
              <strong>{u.skill.name}</strong>
              <span className="rg-meta">
                {u.lessons.length} lessons · {Math.round(left / 60)}h · you're {level.label.toLowerCase()} {level.emoji}
              </span>
            </div>
          </li>
        );
      })}
      <li className="rg-item rg-finish" style={{ "--i": path.length } as React.CSSProperties}>
        <span className="rg-node">🏆</span>
        <div className="rg-body">
          <small>Goal</small>
          <strong>{goal.roleTitle}</strong>
          <span className="rg-meta">Estimated finish {finish}</span>
        </div>
      </li>
    </ol>
  );
}

function lateBy(deadline: string, finish: string): string {
  const days = daysBetween(deadline, finish);
  return days < 14 ? plural(days, "day") : plural(Math.round(days / 7), "week");
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="mascot-row">
      <RocketMark size={44} />
      <div className="speech">{children}</div>
    </div>
  );
}

function Stat({ big, label, sub }: { big: string; label: string; sub?: string }) {
  return (
    <div className="stat card">
      <div className="stat-big">{big}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function LiveEstimate({ weeks, hours }: { weeks: number; hours: number }) {
  return (
    <p className="live-estimate">
      ⏳ That's about <b>{plural(weeks, "week")}</b> for your {hours} hours of learning.
    </p>
  );
}
