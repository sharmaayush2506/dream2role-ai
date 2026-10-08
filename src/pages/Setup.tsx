import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROLES, findRole } from "../../shared/catalog.ts";
import { LEVEL_LABELS, addDays, daysBetween, estimate, type Goal, type SkillLevel } from "../../shared/plan.ts";
import { localDay } from "../../shared/game.ts";
import { api } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { formatDate, plural } from "../lib/format.ts";
import { ThemeMenu } from "../lib/theme.tsx";

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

  async function finish() {
    if (!goal) return;
    setSaving(true);
    setError("");
    try {
      const { user } = await api.saveGoal(goal);
      setUser(user);
      navigate("/learn");
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
            <div className="unit-preview">
              {role.skills.map((s) => (
                <div key={s.id} className="unit-preview-item">
                  <span>{s.icon}</span> {s.name}
                  <em>{LEVEL_LABELS[levels[s.id] ?? 0].emoji}</em>
                </div>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
          </section>
        )}
      </div>

      <footer className="setup-footer">
        {step < 4 ? (
          <button className="btn btn-green btn-xl" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Continue
          </button>
        ) : (
          <button className="btn btn-green btn-xl" disabled={saving} onClick={finish}>
            {saving ? "Building your path…" : existing ? "Save my plan" : "Start my journey 🚀"}
          </button>
        )}
      </footer>
    </div>
  );
}

function lateBy(deadline: string, finish: string): string {
  const days = daysBetween(deadline, finish);
  return days < 14 ? plural(days, "day") : plural(Math.round(days / 7), "week");
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="mascot-row">
      <span className="mascot">🚀</span>
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
