import { useEffect, useState } from "react";
import { api, type AiResult, type LessonNotes, type NoteDepth } from "../lib/api.ts";

const DEPTHS: { value: NoteDepth; label: string; hint: string }[] = [
  { value: "quick", label: "Quick summary", hint: "Skimmable, 2-minute read" },
  { value: "detailed", label: "Detailed", hint: "Full explanations and a worked example" },
  { value: "exam", label: "Exam prep", hint: "What the level test checks, plus practice" },
];

/** AI study notes for one lesson, tailored to the learner's role, level and focus. */
export default function LessonNotesPanel({
  lessonId,
  lessonTitle,
  skillName,
  roleTitle,
  levelLabel,
}: {
  lessonId: string;
  lessonTitle: string;
  skillName: string;
  roleTitle: string;
  levelLabel: string;
}) {
  const [depth, setDepth] = useState<NoteDepth>("detailed");
  const [focus, setFocus] = useState("");
  const [notes, setNotes] = useState<AiResult<LessonNotes> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState<Set<number>>(new Set());

  async function load(refresh = false) {
    setBusy(true);
    setError("");
    try {
      setNotes(await api.lessonNotes(lessonId, depth, focus, refresh));
      setShown(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Show saved notes for the default style straight away (instant if generated before).
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const n = notes?.data;
  return (
    <div className="notes-panel">
      <div className="notes-controls no-print">
        <div className="notes-depths" role="radiogroup" aria-label="Note style">
          {DEPTHS.map((d) => (
            <button
              key={d.value}
              role="radio"
              aria-checked={depth === d.value}
              className={`level-chip ${depth === d.value ? "selected" : ""}`}
              title={d.hint}
              onClick={() => setDepth(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="notes-focus">
          <input
            className="input"
            placeholder="Anything specific? e.g. explain with real e-commerce examples"
            value={focus}
            maxLength={200}
            onChange={(e) => setFocus(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button className="btn btn-green btn-sm" disabled={busy} onClick={() => load()}>
            {busy ? "Writing…" : "✦ Get notes"}
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {busy && (
        <div className="notes-loading">
          <span className="ai-dots"><i /><i /><i /></span> Writing notes for a {levelLabel.toLowerCase()} learner…
        </div>
      )}

      {n && !busy && (
        <article className="lesson-notes">
          <header className="notes-head">
            <div>
              <small className="modal-kicker">{skillName} · Study notes</small>
              <h3>{lessonTitle}</h3>
              <p className="notes-for">
                For a {levelLabel.toLowerCase()} learner aiming to become a {roleTitle}
                {notes.source === "ai" ? <span className="badge-ai">✦ AI written</span> : <span className="badge-offline">basic version (no AI)</span>}
              </p>
            </div>
            <div className="notes-actions no-print">
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => load(true)}>Regenerate</button>
              <button className="btn btn-outline btn-sm" onClick={() => window.print()}>Save PDF</button>
            </div>
          </header>
          {notes.aiError && <p className="notes-error no-print">AI couldn't write these notes: {notes.aiError}</p>}

          <p className="notes-summary">{n.summary}</p>

          {n.keyConcepts.length > 0 && (
            <section>
              <h4>Key concepts</h4>
              <dl className="notes-concepts">
                {n.keyConcepts.map((c) => (
                  <div key={c.term}>
                    <dt>{c.term}</dt>
                    <dd>{c.explanation}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {n.example.content && (
            <section>
              <h4>Example{n.example.title ? `: ${n.example.title}` : ""}</h4>
              {n.example.language ? (
                <pre className="notes-code"><span className="code-lang">{n.example.language}</span><code>{n.example.content}</code></pre>
              ) : (
                <p className="notes-scenario">{n.example.content}</p>
              )}
            </section>
          )}

          {n.steps.length > 0 && (
            <section>
              <h4>Step by step</h4>
              <ol>{n.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </section>
          )}

          {n.commonMistakes.length > 0 && (
            <section>
              <h4>Common mistakes</h4>
              <ul className="notes-mistakes">{n.commonMistakes.map((s) => <li key={s}>{s}</li>)}</ul>
            </section>
          )}

          {n.practice.length > 0 && (
            <section>
              <h4>Practice</h4>
              <ol className="notes-practice">
                {n.practice.map((p, i) => (
                  <li key={p.question}>
                    <p>{p.question}</p>
                    {shown.has(i) ? (
                      <p className="notes-answer">{p.answer}</p>
                    ) : (
                      <button className="link-btn no-print" onClick={() => setShown(new Set(shown).add(i))}>Show answer</button>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {n.cheatSheet.length > 0 && (
            <section className="notes-cheat">
              <h4>Cheat sheet</h4>
              <ul>{n.cheatSheet.map((s) => <li key={s}>{s}</li>)}</ul>
            </section>
          )}
        </article>
      )}
    </div>
  );
}
