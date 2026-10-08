import { useMemo } from "react";
import type { GameEvent } from "../../shared/game.ts";

function describe(e: GameEvent): { emoji: string; title: string; body: string } | null {
  switch (e.type) {
    case "path-complete":
      return { emoji: "🏆", title: "Every lesson complete!", body: "Pass the final level test, then go get that dream job!" };
    case "unit-complete":
      return { emoji: "🏁", title: `All ${e.name} lessons done!`, body: "+200 bonus XP. Pass the level test to unlock the next level." };
    case "test-passed":
      return { emoji: "👑", title: `${e.name} level passed!`, body: `${e.score}/${e.total} correct. The next level is unlocked.` };
    case "certificate":
      return { emoji: "🎓", title: "Certified!", body: `You earned "${e.title}".` };
    case "level-up":
      return { emoji: "⭐", title: `Level ${e.level}!`, body: `You're now a ${e.title}.` };
    case "lesson-complete":
      return { emoji: "✅", title: "Lesson complete!", body: `${e.title} is done. +50 bonus XP` };
    case "daily-goal":
      return { emoji: "🎯", title: "Daily goal reached!", body: "Your future self says thanks." };
    default:
      return null;
  }
}

const COLORS = ["#58cc02", "#1cb0f6", "#ff9600", "#ce82ff", "#ffc800", "#ff4b4b"];

export default function Celebration({ events, onDone }: { events: GameEvent[]; onDone: () => void }) {
  const items = events.map(describe).filter((x): x is NonNullable<typeof x> => !!x);
  const main = items[0];
  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
      })),
    [],
  );
  if (!main) return null;

  return (
    <div className="modal-backdrop celebrate" onClick={onDone}>
      {confetti.map((c, i) => (
        <span key={i} className="confetti" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, background: c.color, rotate: `${c.rotate}deg` }} />
      ))}
      <div className="modal card celebrate-card" onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-emoji bob">{main.emoji}</div>
        <h2>{main.title}</h2>
        <p>{main.body}</p>
        {items.slice(1).map((it) => (
          <p key={it.title} className="celebrate-extra">{it.emoji} <b>{it.title}</b> {it.body}</p>
        ))}
        <button className="btn btn-green btn-xl btn-block" onClick={onDone}>Continue</button>
      </div>
    </div>
  );
}
