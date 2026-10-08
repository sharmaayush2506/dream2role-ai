import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { levelInfo, liveStreak, localDay, weekSummary, type GameEvent } from "../../shared/game.ts";
import { buildPath, dailyGoalMinutes, estimate, lessonAvailable, lessonDone, nextStep, roleForGoal, type Lesson, type NextStep, type Unit } from "../../shared/plan.ts";
import { careerReadiness } from "../../shared/certs.ts";
import { api } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useToast } from "../lib/toasts.tsx";
import { formatDate, minutesLabel, plural } from "../lib/format.ts";
import LessonModal from "../components/LessonModal.tsx";
import Celebration from "../components/Celebration.tsx";
import WeekBars from "../components/WeekBars.tsx";
import TestRunner from "../components/TestRunner.tsx";
import NetworkBackground from "../components/NetworkBackground.tsx";

const UNIT_COLORS = ["green", "purple", "blue", "orange", "pink", "teal"];
// Zig-zag offsets (in px) for lesson nodes, Duolingo style.
const OFFSETS = [0, 44, 70, 44, 0, -44, -70, -44];

export default function Learn() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  // Arriving straight from "Generate my roadmap": build the path in, level by level.
  const fresh = !!(useLocation().state as { fresh?: boolean } | null)?.fresh;
  const me = user!;
  const goal = me.goal!;
  const today = localDay();
  const path = useMemo(() => buildPath(goal), [goal]);
  const lm = me.progress.lessonMinutes;
  const passed = me.progress.passedTests;
  const step = nextStep(path, lm, passed);
  const readiness = careerReadiness(goal, passed);
  const est = estimate(goal, lm, today);
  const lvl = levelInfo(me.progress.xp);
  const dailyGoal = dailyGoalMinutes(goal);
  const todayMinutes = me.progress.activity.find((a) => a.date === today)?.minutes ?? 0;
  const week = weekSummary(me.progress.activity, today);
  const streak = liveStreak(me.progress, today);

  const [open, setOpen] = useState<Lesson | null>(null);
  const [celebrate, setCelebrate] = useState<GameEvent[]>([]);
  const [testFor, setTestFor] = useState<Unit | null>(null);

  async function study(lesson: Lesson, minutes: number) {
    const { user, events } = await api.study(lesson.id, minutes);
    setUser(user);
    setOpen(null);
    for (const e of events) {
      if (e.type === "xp") toast({ emoji: "💎", title: `+${e.amount} XP`, body: `${minutesLabel(minutes)} on ${lesson.title}`, tone: "blue" });
      if (e.type === "streak") toast({ emoji: "🔥", title: e.days === 1 ? "Streak started!" : `${e.days}-day streak!`, body: e.days > 1 ? "Keep the flame alive tomorrow." : "Come back tomorrow to grow it.", tone: "orange" });
    }
    const big = events.filter((e) => ["lesson-complete", "unit-complete", "level-up", "daily-goal", "path-complete"].includes(e.type));
    if (big.length) setCelebrate(big);
  }

  return (
    <div className="learn">
      <NetworkBackground />
      <div className={`path-col ${fresh ? "path-reveal" : ""}`}>
        {path.map((unit, ui) => (
          <UnitSection
            key={unit.skill.id}
            style={{ "--i": ui } as React.CSSProperties}
            unit={unit}
            index={ui}
            color={UNIT_COLORS[ui % UNIT_COLORS.length]}
            lessonMinutes={lm}
            step={step}
            passed={!!passed[unit.skill.id]}
            onOpen={setOpen}
            onTest={() => setTestFor(unit)}
          />
        ))}
        <div className="finish-line">
          <span className="finish-trophy">🏆</span>
          <strong>{roleForGoal(goal).title}</strong>
          <small>Estimated finish: {formatDate(est.finishDate)}</small>
        </div>
      </div>

      <aside className="side-col">
        <div className="card panel">
          <div className="panel-head">
            <h3>Level {lvl.level} · {lvl.title}</h3>
            <span className="muted">{lvl.into}/{lvl.span} XP</span>
          </div>
          <div className="bar bar-gold"><div className="bar-fill" style={{ width: `${(lvl.into / lvl.span) * 100}%` }} /></div>
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h3>Daily goal</h3>
            <span className="muted">{Math.min(todayMinutes, dailyGoal)}/{dailyGoal} min</span>
          </div>
          <div className="bar bar-orange"><div className="bar-fill" style={{ width: `${Math.min(100, (todayMinutes / dailyGoal) * 100)}%` }} /></div>
          <p className="panel-note">{todayMinutes >= dailyGoal ? "Done for today! 🏅" : streak ? `🔥 ${plural(streak, "day")} streak, keep it going!` : "Study today to start a streak 🔥"}</p>
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h3>This week</h3>
            <span className="muted">{minutesLabel(week.minutes)} / {goal.hoursPerWeek}h</span>
          </div>
          <div className="bar bar-blue"><div className="bar-fill" style={{ width: `${Math.min(100, (week.minutes / (goal.hoursPerWeek * 60)) * 100)}%` }} /></div>
          <WeekBars days={week.days} today={today} goal={dailyGoal} />
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h3>Road to the job</h3>
            <span className="muted">{est.percentDone}%</span>
          </div>
          <div className="bar bar-green"><div className="bar-fill" style={{ width: `${est.percentDone}%` }} /></div>
          <ul className="estimate-list">
            <li><b>{est.remainingHours}h</b> left to learn</li>
            <li><b>{plural(est.weeksNeeded, "week")}</b> at {goal.hoursPerWeek} h/week</li>
            <li>Finish around <b>{formatDate(est.finishDate)}</b></li>
            {est.deadline && (
              <li className={est.onTrack ? "good" : "warn"}>
                {est.onTrack ? `✅ On track for ${formatDate(est.deadline)}` : `⚠️ Need ${est.hoursPerWeekForDeadline} h/week for ${formatDate(est.deadline)}`}
              </li>
            )}
          </ul>
          <button className="btn btn-outline btn-sm btn-block" onClick={() => navigate("/setup")}>Adjust my plan</button>
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h3>Career hub</h3>
            <span className="muted">{readiness.passed}/{readiness.total} tests</span>
          </div>
          <ul className="unlock-list">
            <li className="on">✅ Internship matches</li>
            <li className="on">✅ AI project ideas</li>
            <li className="on">✅ AI resume builder</li>
          </ul>
          <button className="btn btn-outline btn-sm btn-block" onClick={() => navigate("/career")}>Open career hub</button>
        </div>

        <div className="card panel">
          <h3>Skills</h3>
          {path.map((u, i) => {
            const total = u.lessons.reduce((s, l) => s + l.minutes, 0);
            const done = u.lessons.reduce((s, l) => s + (l.placedOut ? l.minutes : Math.min(l.minutes, lm[l.id] ?? 0)), 0);
            return (
              <div key={u.skill.id} className="skill-bar">
                <div className="skill-bar-label">
                  <span>{u.skill.icon} {u.skill.name}</span>
                  <span className="muted">{Math.round((done / total) * 100)}%</span>
                </div>
                <div className={`bar bar-sm bar-${UNIT_COLORS[i % UNIT_COLORS.length]}`}>
                  <div className="bar-fill" style={{ width: `${(done / total) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {open && (
        <LessonModal
          lesson={open}
          unit={path.find((u) => u.skill.id === open.skillId)!}
          roleTitle={goal.roleTitle}
          minutesDone={lm[open.id] ?? 0}
          done={lessonDone(open, lm)}
          onClose={() => setOpen(null)}
          onStudy={(m) => study(open, m)}
        />
      )}
      {celebrate.length > 0 && <Celebration events={celebrate} onDone={() => setCelebrate([])} />}
      {testFor && (
        <TestRunner
          kind="level"
          refId={testFor.skill.id}
          intro={`${testFor.skill.icon} ${testFor.skill.name}: score at least 70% to unlock the next level.`}
          onClose={() => setTestFor(null)}
          onFinished={(r) => {
            setUser(r.user);
            for (const e of r.events) {
              if (e.type === "level-up") toast({ emoji: "⭐", title: `Level ${e.level}!`, body: `You're now a ${e.title}.`, tone: "gold" });
              if (e.type === "test-passed") toast({ emoji: "🎓", title: "A new certificate is available", body: "Open Certificates to get certified.", tone: "purple" });
            }
          }}
        />
      )}
    </div>
  );
}

function UnitSection({
  unit,
  index,
  color,
  lessonMinutes,
  step,
  passed,
  onOpen,
  onTest,
  style,
}: {
  style?: React.CSSProperties;
  unit: Unit;
  index: number;
  color: string;
  lessonMinutes: Record<string, number>;
  step: NextStep;
  passed: boolean;
  onOpen: (l: Lesson) => void;
  onTest: () => void;
}) {
  const current = step?.kind === "lesson" ? step.id : null;
  const testReady = step?.kind === "test" && step.skillId === unit.skill.id;
  const testState = passed ? "done" : testReady ? "current" : "locked";

  return (
    <section className="unit" style={style}>
      <div className={`unit-banner unit-${color}`}>
        <div>
          <small>LEVEL {index + 1}</small>
          <h2>{unit.skill.icon} {unit.skill.name}</h2>
          <p>{unit.lessons.length} lessons · {unit.skill.hours}h total</p>
        </div>
        {passed && <span className="unit-crown" title="Level test passed">👑</span>}
      </div>
      <div className="nodes">
        {unit.lessons.map((l, i) => {
          const done = lessonDone(l, lessonMinutes);
          const isCurrent = l.id === current;
          const pct = l.placedOut ? 100 : Math.min(100, ((lessonMinutes[l.id] ?? 0) / l.minutes) * 100);
          const state = done ? "done" : isCurrent ? "current" : lessonAvailable(l, step, lessonMinutes) ? "open" : "locked";
          return (
            <div key={l.id} className={`node-wrap ${isCurrent ? "has-bubble" : ""}`} style={{ transform: `translateX(${OFFSETS[(i + index * 2) % OFFSETS.length]}px)` }}>
              {isCurrent && <div className="start-bubble">{pct > 0 ? "CONTINUE" : "START"}</div>}
              <button
                className={`node node-${state} node-${color}`}
                style={{ "--pct": `${pct}%` } as React.CSSProperties}
                disabled={state === "locked"}
                onClick={() => onOpen(l)}
                aria-label={`${l.title}${done ? " (complete)" : state === "locked" ? " (locked)" : ""}`}
              >
                <span className="node-inner">{done ? (l.placedOut ? "⭐" : "✓") : state === "locked" ? "🔒" : unit.skill.icon}</span>
              </button>
              <span className="node-label">{l.title}</span>
            </div>
          );
        })}
        <div className={`node-wrap ${testReady ? "has-bubble" : ""}`}>
          {testReady && <div className="start-bubble test-bubble">LEVEL TEST</div>}
          <button
            className={`node node-test node-${testState === "done" ? "done" : "test"} ${testState === "current" ? "node-current" : ""} ${testState === "locked" ? "node-locked" : ""}`}
            style={{ "--pct": testState === "done" ? "100%" : "0%" } as React.CSSProperties}
            disabled={testState !== "current"}
            onClick={onTest}
            aria-label={`${unit.skill.name} level test${passed ? " (passed)" : testState === "locked" ? " (locked)" : ""}`}
          >
            <span className="node-inner">{passed ? "👑" : testState === "locked" ? "🔒" : "🏆"}</span>
          </button>
          <span className="node-label">{passed ? "Level test passed" : "Level test (compulsory)"}</span>
        </div>
      </div>
    </section>
  );
}
