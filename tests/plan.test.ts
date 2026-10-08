import { describe, expect, it } from "vitest";
import { buildPath, nextStep, estimate, type Goal } from "../shared/plan.ts";
import { emptyProgress, levelInfo, liveStreak, logStudy, weekStart, weekSummary } from "../shared/game.ts";

const goal = (over: Partial<Goal> = {}): Goal => ({
  roleId: "frontend-dev",
  roleTitle: "Frontend Developer",
  levels: {},
  hoursPerWeek: 10,
  deadline: null,
  createdAt: "",
  ...over,
});

describe("estimate", () => {
  it("covers the whole path for a total beginner", () => {
    const e = estimate(goal(), {}, "2026-01-05");
    expect(e.totalHours).toBe(330);
    expect(e.remainingHours).toBe(330);
    expect(e.weeksNeeded).toBe(33);
    expect(e.percentDone).toBe(0);
  });

  it("skips lessons the user already knows", () => {
    const g = goal({ levels: { "html-css": 3, javascript: 2 } });
    const path = buildPath(g);
    expect(path[0].lessons.filter((l) => l.placedOut)).toHaveLength(3);
    expect(estimate(g, {}, "2026-01-05").remainingHours).toBeLessThan(330);
    expect(nextStep(path, {}, {})).toEqual({ kind: "lesson", id: "html-css:3", skillId: "html-css" });
  });

  it("more hours per week means an earlier finish", () => {
    const slow = estimate(goal({ hoursPerWeek: 5 }), {}, "2026-01-05");
    const fast = estimate(goal({ hoursPerWeek: 20 }), {}, "2026-01-05");
    expect(fast.finishDate < slow.finishDate).toBe(true);
  });

  it("flags a deadline that's too tight and says how much time is needed", () => {
    const e = estimate(goal({ deadline: "2026-04-05" }), {}, "2026-01-05");
    expect(e.onTrack).toBe(false);
    expect(e.hoursPerWeekForDeadline).toBeGreaterThan(10);
    const ok = estimate(goal({ deadline: "2027-06-01" }), {}, "2026-01-05");
    expect(ok.onTrack).toBe(true);
  });
});

describe("logStudy", () => {
  it("awards XP, completes lessons and grows the streak day by day", () => {
    const g = goal();
    let p = emptyProgress();
    let r = logStudy(g, p, "html-css:0", 60, "2026-01-05", 30);
    expect(r.progress.streak).toBe(1);
    expect(r.events.map((e) => e.type)).toContain("daily-goal");
    p = r.progress;
    r = logStudy(g, p, "html-css:0", 240, "2026-01-06", 30);
    expect(r.progress.streak).toBe(2);
    expect(r.progress.lessonMinutes["html-css:0"]).toBe(300);
    expect(r.events.map((e) => e.type)).not.toContain("lesson-complete");
    // HTML & CSS is 60h over 4 lessons, so each lesson is 900 minutes.
    for (const day of ["2026-01-07", "2026-01-08", "2026-01-09"]) r = logStudy(g, r.progress, "html-css:0", 200, day, 30);
    expect(r.progress.lessonMinutes["html-css:0"]).toBe(900); // capped at the lesson length
    expect(r.events.map((e) => e.type)).toContain("lesson-complete");
    expect(r.progress.streak).toBe(5);
    expect(r.progress.xp).toBe(60 + 240 + 600 + 50);
  });

  it("resets the streak after a missed day", () => {
    const g = goal();
    const a = logStudy(g, emptyProgress(), "html-css:0", 30, "2026-01-05", 30).progress;
    expect(liveStreak(a, "2026-01-07")).toBe(0);
    const b = logStudy(g, a, "html-css:0", 30, "2026-01-08", 30).progress;
    expect(b.streak).toBe(1);
  });
});

describe("levels and weeks", () => {
  it("computes levels from XP", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(299).level).toBe(2);
    expect(levelInfo(300).level).toBe(3);
  });

  it("summarizes the current Monday-to-Sunday week", () => {
    expect(weekStart("2026-01-08")).toBe("2026-01-05");
    const w = weekSummary(
      [
        { date: "2026-01-04", minutes: 99, xp: 99 },
        { date: "2026-01-05", minutes: 30, xp: 30 },
        { date: "2026-01-07", minutes: 20, xp: 70 },
      ],
      "2026-01-08",
    );
    expect(w.minutes).toBe(50);
    expect(w.xp).toBe(100);
    expect(w.days[2].minutes).toBe(20);
  });
});
