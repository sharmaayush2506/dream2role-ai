import { useEffect, useState } from "react";

export interface Stage {
  label: string; // shown while working, e.g. "Analyzing your target role..."
  done: string; // shown when finished, e.g. "Role requirements"
  detail?: string; // a real fact from the plan, e.g. "5 core skills for Frontend Developer"
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Full-screen "AI is working" sequence. Each stage ticks off in turn; the last stage
 * waits for the real work (`work`) to finish before showing "Roadmap ready".
 */
export default function AiThinking({
  stages,
  work,
  onDone,
  onError,
}: {
  stages: Stage[];
  work: Promise<unknown>;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [active, setActive] = useState(0); // index of the stage in progress
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < stages.length - 1; i++) {
        await wait(850 + Math.random() * 450);
        if (cancelled) return;
        setActive(i + 1);
      }
      try {
        await Promise.all([work, wait(1100)]);
      } catch (e) {
        if (!cancelled) onError((e as Error).message);
        return;
      }
      if (cancelled) return;
      setActive(stages.length);
      setReady(true);
      await wait(1100);
      if (!cancelled) onDone();
    })();
    return () => {
      cancelled = true;
    };
    // The sequence runs once per mount; callbacks are stable enough for this one-shot screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work]);

  return (
    <div className="ai-thinking" role="status" aria-live="polite">
      <div className="ai-thinking-card">
        <div className="ai-brand">
          <span className="ai-spark">✦</span> Dream2Role AI
        </div>
        <ol className="ai-stages">
          {stages.map((s, i) => {
            const state = i < active ? "done" : i === active ? "active" : "pending";
            const last = i === stages.length - 1;
            return (
              <li key={s.label} className={`ai-stage ${state}`}>
                <div className="ai-stage-label">{s.label}</div>
                <div className="ai-stage-result">
                  {state === "done" ? (
                    <>
                      <span className="ai-check">✓</span>
                      <span>
                        {s.done}
                        {s.detail && <small>{s.detail}</small>}
                      </span>
                    </>
                  ) : state === "active" ? (
                    last ? <span className="ai-orb" /> : <span className="ai-dots"><i /><i /><i /></span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        <div className={`ai-ready ${ready ? "show" : ""}`}>✨ ROADMAP READY</div>
      </div>
    </div>
  );
}
