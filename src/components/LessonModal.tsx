import { useState } from "react";
import type { Lesson, Unit } from "../../shared/plan.ts";
import { minutesLabel } from "../lib/format.ts";
import LessonNotesPanel from "./LessonNotesPanel.tsx";

const SESSIONS = [15, 30, 45, 60, 90];

const TIPS = [
  "🎬 Watch a tutorial, then pause and re-build it yourself.",
  "✍️ Write a one-paragraph summary as if teaching a friend.",
  "🛠️ Build a tiny project using only what you just learned.",
  "🃏 Make 5 flashcards for the trickiest ideas.",
];

export default function LessonModal({
  lesson,
  unit,
  roleTitle,
  minutesDone,
  done,
  onClose,
  onStudy,
}: {
  lesson: Lesson;
  unit: Unit;
  roleTitle: string;
  minutesDone: number;
  done: boolean;
  onClose: () => void;
  onStudy: (minutes: number) => Promise<void>;
}) {
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"study" | "notes">("study");
  const pct = lesson.placedOut ? 100 : Math.min(100, (minutesDone / lesson.minutes) * 100);
  const query = encodeURIComponent(`${lesson.title} ${unit.skill.name} for ${roleTitle}`);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onStudy(minutes);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" role="dialog" aria-label={lesson.title} onClick={(e) => e.stopPropagation()}>
        <button className="popup-close" aria-label="Close" onClick={onClose}>✕</button>
        <small className="modal-kicker">{unit.skill.icon} {unit.skill.name}</small>
        <h2>{lesson.title}</h2>

        <div className="tabs lesson-tabs no-print" role="tablist">
          <button role="tab" aria-selected={tab === "study"} className={tab === "study" ? "active" : ""} onClick={() => setTab("study")}>
            Study
          </button>
          <button role="tab" aria-selected={tab === "notes"} className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>
            📝 Notes
          </button>
        </div>

        {tab === "notes" ? (
          <LessonNotesPanel skillId={unit.skill.id} skillName={unit.skill.name} lessonTitle={lesson.title} />
        ) : (
          <>
            <div className="lesson-progress">
              <div className="bar bar-green bar-lg"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
              <span>
                {lesson.placedOut ? "You tested out of this one ⭐" : `${minutesLabel(Math.min(minutesDone, lesson.minutes))} of ${minutesLabel(lesson.minutes)}`}
              </span>
            </div>

            <ul className="tips">
              {TIPS.slice(0, 3).map((t) => <li key={t}>{t}</li>)}
            </ul>
            <div className="resource-links">
              <a href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noreferrer">▶️ Videos</a>
              <a href={`https://www.google.com/search?q=${query}+tutorial`} target="_blank" rel="noreferrer">🔎 Tutorials</a>
              <button className="link-btn" onClick={() => setTab("notes")}>📝 Notes</button>
            </div>

            <h4>{done ? "Practice more?" : "How long did you study?"}</h4>
            <div className="session-chips">
              {SESSIONS.map((m) => (
                <button key={m} className={`level-chip ${minutes === m ? "selected" : ""}`} onClick={() => setMinutes(m)}>
                  {minutesLabel(m)}
                </button>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-green btn-block btn-xl" disabled={busy} onClick={submit}>
              {busy ? "Saving…" : `I studied! +${minutes} XP`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
