import { findRole, type RoleDef, type SkillDef } from "./catalog.ts";

/** 0 = never touched it, 1 = beginner, 2 = intermediate, 3 = advanced */
export type SkillLevel = 0 | 1 | 2 | 3;

export const LEVEL_LABELS: Record<SkillLevel, { label: string; emoji: string; hint: string }> = {
  0: { label: "Brand new", emoji: "🥚", hint: "Never tried it" },
  1: { label: "Beginner", emoji: "🐣", hint: "Played around a bit" },
  2: { label: "Intermediate", emoji: "🐥", hint: "Built something small" },
  3: { label: "Advanced", emoji: "🦅", hint: "Use it with confidence" },
};

/** Share of a skill's topics a user "tests out of" at each level. */
const PLACEMENT_SHARE: Record<SkillLevel, number> = { 0: 0, 1: 0.25, 2: 0.5, 3: 0.75 };

export interface Goal {
  roleId: string;
  roleTitle: string;
  levels: Record<string, SkillLevel>;
  hoursPerWeek: number;
  deadline: string | null; // YYYY-MM-DD
  createdAt: string;
}

export interface Lesson {
  id: string; // `${skillId}:${index}`
  skillId: string;
  title: string;
  minutes: number; // study time needed to finish the lesson
  placedOut: boolean; // already known thanks to the user's starting level
}

export interface Unit {
  skill: SkillDef;
  lessons: Lesson[];
}

export function roleForGoal(goal: Pick<Goal, "roleId" | "roleTitle">): RoleDef {
  return findRole(goal.roleId, goal.roleTitle);
}

export function buildPath(goal: Pick<Goal, "roleId" | "roleTitle" | "levels">): Unit[] {
  const role = roleForGoal(goal);
  return role.skills.map((skill) => {
    const level = goal.levels[skill.id] ?? 0;
    const placed = Math.round(skill.topics.length * PLACEMENT_SHARE[level]);
    const minutes = Math.round((skill.hours * 60) / skill.topics.length);
    return {
      skill,
      lessons: skill.topics.map((title, i) => ({
        id: `${skill.id}:${i}`,
        skillId: skill.id,
        title,
        minutes,
        placedOut: i < placed,
      })),
    };
  });
}

export function allLessons(path: Unit[]): Lesson[] {
  return path.flatMap((u) => u.lessons);
}

export function lessonDone(lesson: Lesson, lessonMinutes: Record<string, number>): boolean {
  return lesson.placedOut || (lessonMinutes[lesson.id] ?? 0) >= lesson.minutes;
}

export type NextStep = { kind: "lesson"; id: string; skillId: string } | { kind: "test"; skillId: string } | null;

/**
 * What the learner should do next. Lessons go in order, and each level ends with a
 * compulsory test that must be passed before the next level's lessons unlock.
 */
export function nextStep(path: Unit[], lessonMinutes: Record<string, number>, passedTests: Record<string, unknown>): NextStep {
  for (const unit of path) {
    const next = unit.lessons.find((l) => !lessonDone(l, lessonMinutes));
    if (next) return { kind: "lesson", id: next.id, skillId: unit.skill.id };
    if (!passedTests[unit.skill.id]) return { kind: "test", skillId: unit.skill.id };
  }
  return null;
}

/** A lesson can be studied if it's finished (extra practice) or it's the next step. */
export function lessonAvailable(lesson: Lesson, step: NextStep, lessonMinutes: Record<string, number>): boolean {
  return lessonDone(lesson, lessonMinutes) || (step?.kind === "lesson" && step.id === lesson.id);
}

export interface Estimate {
  totalHours: number; // from zero to job-ready
  remainingHours: number; // what's left for this user
  percentDone: number;
  weeksNeeded: number;
  finishDate: string;
  deadline: string | null;
  weeksToDeadline: number | null;
  onTrack: boolean | null;
  hoursPerWeekForDeadline: number | null;
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDay(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

export function estimate(
  goal: Goal,
  lessonMinutes: Record<string, number>,
  today: string,
): Estimate {
  const lessons = allLessons(buildPath(goal));
  const totalMinutes = lessons.reduce((s, l) => s + l.minutes, 0);
  const remainingMinutes = lessons.reduce(
    (s, l) => (l.placedOut ? s : s + Math.max(0, l.minutes - (lessonMinutes[l.id] ?? 0))),
    0,
  );
  const remainingHours = Math.round(remainingMinutes / 6) / 10;
  const hpw = Math.max(1, goal.hoursPerWeek);
  const weeksNeeded = Math.ceil(remainingHours / hpw);
  const finishDate = addDays(today, Math.ceil((remainingHours / hpw) * 7));

  let weeksToDeadline: number | null = null;
  let onTrack: boolean | null = null;
  let hoursPerWeekForDeadline: number | null = null;
  if (goal.deadline) {
    const days = Math.max(1, daysBetween(today, goal.deadline));
    weeksToDeadline = Math.round((days / 7) * 10) / 10;
    onTrack = finishDate <= goal.deadline;
    hoursPerWeekForDeadline = Math.ceil(remainingHours / (days / 7));
  }

  return {
    totalHours: Math.round(totalMinutes / 60),
    remainingHours,
    percentDone: totalMinutes ? Math.round(((totalMinutes - remainingMinutes) / totalMinutes) * 100) : 0,
    weeksNeeded,
    finishDate,
    deadline: goal.deadline,
    weeksToDeadline,
    onTrack,
    hoursPerWeekForDeadline,
  };
}

export function dailyGoalMinutes(goal: Pick<Goal, "hoursPerWeek">): number {
  return Math.max(10, Math.round((goal.hoursPerWeek * 60) / 7 / 5) * 5);
}
