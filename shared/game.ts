import {
  addDays,
  allLessons,
  buildPath,
  daysBetween,
  lessonDone,
  parseDay,
  formatDay,
  type Goal,
} from "./plan.ts";

export interface DayActivity {
  date: string; // YYYY-MM-DD
  minutes: number;
  xp: number;
}

export interface Progress {
  xp: number;
  streak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  lessonMinutes: Record<string, number>;
  activity: DayActivity[]; // one entry per active day, newest last
  passedTests: Record<string, TestPass>; // level tests passed, keyed by skill id
}

export interface TestPass {
  score: number;
  total: number;
  passedAt: string;
}

export function emptyProgress(): Progress {
  return { xp: 0, streak: 0, longestStreak: 0, lastActiveDate: null, lessonMinutes: {}, activity: [], passedTests: {} };
}

export const XP_PER_MINUTE = 1;
export const LESSON_BONUS_XP = 50;
export const UNIT_BONUS_XP = 200;
export const LEVEL_TEST_XP = 100;

const LEVEL_TITLES = ["Dreamer", "Explorer", "Apprentice", "Builder", "Achiever", "Pro", "Expert", "Master", "Legend"];

/** Player level from total XP. Level n starts at 100 * n * (n - 1) / 2 XP. */
export function levelInfo(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    into: xp - start,
    span: next - start,
  };
}

export function xpForLevel(level: number): number {
  return (100 * level * (level - 1)) / 2;
}

/** The streak as it stands today: it's broken if the last active day was before yesterday. */
export function liveStreak(p: Pick<Progress, "streak" | "lastActiveDate">, today: string): number {
  if (!p.lastActiveDate) return 0;
  return daysBetween(p.lastActiveDate, today) <= 1 ? p.streak : 0;
}

export function streakAtRisk(p: Pick<Progress, "streak" | "lastActiveDate">, today: string): boolean {
  return !!p.lastActiveDate && p.streak > 0 && daysBetween(p.lastActiveDate, today) === 1;
}

export type GameEvent =
  | { type: "xp"; amount: number }
  | { type: "lesson-complete"; title: string }
  | { type: "unit-complete"; name: string }
  | { type: "streak"; days: number }
  | { type: "level-up"; level: number; title: string }
  | { type: "daily-goal" }
  | { type: "path-complete" }
  | { type: "test-passed"; name: string; score: number; total: number }
  | { type: "certificate"; title: string };

/** Add bonus XP (e.g. for passing a test) to today's activity without touching streaks or lessons. */
export function awardXp(prev: Progress, xp: number, today: string): { progress: Progress; events: GameEvent[] } {
  const levelBefore = levelInfo(prev.xp).level;
  const activity = prev.activity.map((a) => ({ ...a }));
  const day = activity.find((a) => a.date === today);
  if (day) day.xp += xp;
  else activity.push({ date: today, minutes: 0, xp });
  const progress = { ...prev, xp: prev.xp + xp, activity };
  const events: GameEvent[] = [{ type: "xp", amount: xp }];
  const after = levelInfo(progress.xp);
  if (after.level > levelBefore) events.push({ type: "level-up", level: after.level, title: after.title });
  return { progress, events };
}

/** Log study time on a lesson. Pure: returns the new progress and what happened. */
export function logStudy(
  goal: Goal,
  prev: Progress,
  lessonId: string,
  minutes: number,
  today: string,
  dailyGoal: number,
): { progress: Progress; events: GameEvent[] } {
  const path = buildPath(goal);
  const lessons = allLessons(path);
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new Error("Unknown lesson");

  const p: Progress = {
    ...prev,
    lessonMinutes: { ...prev.lessonMinutes },
    activity: prev.activity.map((a) => ({ ...a })),
  };
  const events: GameEvent[] = [];
  const wasDone = lessonDone(lesson, p.lessonMinutes);
  const unit = path.find((u) => u.skill.id === lesson.skillId)!;
  const unitWasDone = unit.lessons.every((l) => lessonDone(l, p.lessonMinutes));
  const levelBefore = levelInfo(p.xp).level;

  p.lessonMinutes[lessonId] = Math.min(lesson.minutes, (p.lessonMinutes[lessonId] ?? 0) + minutes);
  let xp = minutes * XP_PER_MINUTE;

  if (!wasDone && lessonDone(lesson, p.lessonMinutes)) {
    xp += LESSON_BONUS_XP;
    events.push({ type: "lesson-complete", title: lesson.title });
    if (!unitWasDone && unit.lessons.every((l) => lessonDone(l, p.lessonMinutes))) {
      xp += UNIT_BONUS_XP;
      events.push({ type: "unit-complete", name: unit.skill.name });
    }
    if (lessons.every((l) => lessonDone(l, p.lessonMinutes))) events.push({ type: "path-complete" });
  }

  // Streak: first activity of the day extends it (or restarts it after a gap).
  if (p.lastActiveDate !== today) {
    p.streak = p.lastActiveDate && daysBetween(p.lastActiveDate, today) === 1 ? p.streak + 1 : 1;
    p.longestStreak = Math.max(p.longestStreak, p.streak);
    p.lastActiveDate = today;
    events.push({ type: "streak", days: p.streak });
  }

  let day = p.activity.find((a) => a.date === today);
  if (!day) {
    day = { date: today, minutes: 0, xp: 0 };
    p.activity.push(day);
  }
  const minutesBefore = day.minutes;
  day.minutes += minutes;
  day.xp += xp;
  if (minutesBefore < dailyGoal && day.minutes >= dailyGoal) events.push({ type: "daily-goal" });
  // Keep ~3 months of history.
  p.activity = p.activity.filter((a) => daysBetween(a.date, today) < 90);

  p.xp += xp;
  events.unshift({ type: "xp", amount: xp });
  const after = levelInfo(p.xp);
  if (after.level > levelBefore) events.push({ type: "level-up", level: after.level, title: after.title });

  return { progress: p, events };
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const dow = (parseDay(day).getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(day, -dow);
}

export interface WeekSummary {
  minutes: number;
  xp: number;
  activeDays: number;
  days: { date: string; minutes: number }[]; // Mon..Sun
}

export function weekSummary(activity: DayActivity[], today: string): WeekSummary {
  const start = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, minutes: activity.find((a) => a.date === date)?.minutes ?? 0 };
  });
  const inWeek = activity.filter((a) => a.date >= start && a.date <= addDays(start, 6));
  return {
    minutes: inWeek.reduce((s, a) => s + a.minutes, 0),
    xp: inWeek.reduce((s, a) => s + a.xp, 0),
    activeDays: inWeek.filter((a) => a.minutes > 0).length,
    days,
  };
}

/** Local calendar day as YYYY-MM-DD. */
export function localDay(d = new Date()): string {
  return formatDay(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}
