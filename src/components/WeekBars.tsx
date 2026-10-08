const DAY_NAMES = ["M", "T", "W", "T", "F", "S", "S"];

/** Seven little columns, Monday to Sunday, showing minutes studied each day. */
export default function WeekBars({ days, today, goal }: { days: { date: string; minutes: number }[]; today?: string; goal: number }) {
  const max = Math.max(goal, ...days.map((d) => d.minutes), 1);
  return (
    <div className="week-bars">
      {days.map((d, i) => (
        <div key={d.date} className={`week-day ${d.date === today ? "is-today" : ""}`} title={`${d.date}: ${d.minutes} min`}>
          <div className="week-col">
            <div className={`week-fill ${d.minutes >= goal ? "met" : ""}`} style={{ height: `${(d.minutes / max) * 100}%` }} />
          </div>
          <span>{DAY_NAMES[i]}</span>
        </div>
      ))}
    </div>
  );
}
