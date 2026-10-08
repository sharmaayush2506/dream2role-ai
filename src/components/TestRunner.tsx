import { useEffect, useState } from "react";
import { api, type TestResult, type TestSession } from "../lib/api.ts";

type Feedback = { correct: boolean; answerIndex: number; explanation: string };

/**
 * Full-screen, Duolingo-style multiple-choice test. Each answer is locked in on the server
 * before the correct answer is revealed, so results can't be peeked at.
 */
export default function TestRunner({
  kind,
  refId,
  intro,
  onClose,
  onFinished,
}: {
  kind: "level" | "cert";
  refId: string;
  intro: string;
  onClose: () => void;
  onFinished: (r: TestResult) => void;
}) {
  const [test, setTest] = useState<TestSession | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .startTest(kind, refId)
      .then((t) => {
        if (cancelled) return;
        // Resume where the learner left off if they closed the test midway.
        const firstOpen = t.answers.findIndex((a) => a === null);
        if (firstOpen === -1) {
          // Every question was answered before closing: go straight to the results.
          return api.finishTest(t.testId).then((r) => {
            if (cancelled) return;
            setTest(t);
            setResult(r);
            onFinished(r);
          });
        }
        setTest(t);
        setIndex(firstOpen);
        setCorrectCount(t.correctSoFar);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // onFinished is a fresh closure on every render; starting the test once per kind/ref is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, refId]);

  async function check() {
    if (!test || choice === null) return;
    setBusy(true);
    try {
      const fb = await api.answer(test.testId, index, choice);
      setFeedback(fb);
      if (fb.correct) setCorrectCount((c) => c + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!test) return;
    if (index < test.questions.length - 1) {
      setIndex(index + 1);
      setChoice(null);
      setFeedback(null);
      return;
    }
    setBusy(true);
    try {
      const r = await api.finishTest(test.testId);
      setResult(r);
      onFinished(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const q = test?.questions[index];
  const pct = test ? ((index + (feedback ? 1 : 0)) / test.questions.length) * 100 : 0;

  return (
    <div className="test-screen" role="dialog" aria-label={test?.title ?? "Test"}>
      <div className="setup-top">
        <button className="icon-btn" aria-label="Quit test" onClick={onClose}>✕</button>
        <div className="bar bar-lg"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
        {test && <span className="setup-step">✅ {correctCount}</span>}
      </div>

      <div className="test-body">
        {error && (
          <div className="test-center">
            <div className="celebrate-emoji">😵</div>
            <p className="form-error">{error}</p>
            <button className="btn btn-blue" onClick={onClose}>Back</button>
          </div>
        )}

        {!test && !error && (
          <div className="test-center">
            <div className="celebrate-emoji bob">🧠</div>
            <h2>Preparing your questions…</h2>
            <p className="muted">{intro}</p>
          </div>
        )}

        {test && q && !result && !error && (
          <section key={index} className="test-question">
            <small className="modal-kicker">
              {test.title} · Question {index + 1} of {test.questions.length}
              {test.source === "offline" && <span className="badge-offline" title="AI isn't configured on the server, so these are practice questions">practice mode</span>}
            </small>
            <h2>{q.question}</h2>
            <div className="options">
              {q.options.map((opt, i) => {
                const state = feedback
                  ? i === feedback.answerIndex
                    ? "right"
                    : i === choice
                      ? "wrong"
                      : ""
                  : i === choice
                    ? "selected"
                    : "";
                return (
                  <button key={i} className={`option ${state}`} disabled={!!feedback} onClick={() => setChoice(i)}>
                    <span className="option-key">{i + 1}</span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {result && (
          <div className="test-center">
            <div className="celebrate-emoji bob">{result.passed ? (kind === "cert" ? "🎓" : "🏆") : "💪"}</div>
            <h2>{result.passed ? "You passed!" : "Not quite yet"}</h2>
            <p className="test-score">
              {result.score} / {result.total} correct · needed {result.passPercent}%
            </p>
            <p className="muted">
              {result.passed
                ? kind === "cert"
                  ? "Your certificate is ready in the Certificates panel."
                  : "The next level is unlocked. +100 XP!"
                : "Review the lessons and try again. You'll get a fresh set of questions."}
            </p>
            <button className="btn btn-green btn-xl" onClick={onClose}>Continue</button>
          </div>
        )}
      </div>

      {test && q && !result && !error && (
        <footer className={`test-footer ${feedback ? (feedback.correct ? "is-right" : "is-wrong") : ""}`}>
          <div className="test-footer-inner">
            {feedback ? (
              <div className="feedback">
                <strong>{feedback.correct ? "🎉 Nice!" : "Correct answer:"}</strong>
                {!feedback.correct && <span> {q.options[feedback.answerIndex]}</span>}
                <p>{feedback.explanation}</p>
              </div>
            ) : (
              <span />
            )}
            {feedback ? (
              <button className={`btn btn-xl ${feedback.correct ? "btn-green" : "btn-red"}`} disabled={busy} onClick={next}>
                {index < test.questions.length - 1 ? "Continue" : busy ? "Scoring…" : "See results"}
              </button>
            ) : (
              <button className="btn btn-green btn-xl" disabled={choice === null || busy} onClick={check}>Check</button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
