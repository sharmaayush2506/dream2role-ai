// Demo learners, so friend suggestions and the leaderboard have someone in them.
// All demo accounts use the password "demo1234" (e.g. aarav@demo.dream2role).
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db, save } from "./db.ts";
import { findRole } from "../shared/catalog.ts";
import { addDays, allLessons, buildPath, dailyGoalMinutes, type Goal, type SkillLevel } from "../shared/plan.ts";
import { emptyProgress, localDay, logStudy } from "../shared/game.ts";

const DEMO = [
  { name: "Aarav Mehta", avatar: "🐯", roleId: "frontend-dev", hours: 8, days: 9 },
  { name: "Priya Nair", avatar: "🦄", roleId: "data-scientist", hours: 10, days: 15 },
  { name: "Kabir Singh", avatar: "🐸", roleId: "frontend-dev", hours: 5, days: 4 },
  { name: "Sara Khan", avatar: "🐼", roleId: "ux-designer", hours: 6, days: 21 },
  { name: "Leo Martins", avatar: "🦉", roleId: "cloud-engineer", hours: 12, days: 2 },
  { name: "Mia Chen", avatar: "🐙", roleId: "data-scientist", hours: 7, days: 6 },
];

/** Adds the demo learners if they don't exist yet (safe to run repeatedly). Returns how many are present. */
export async function seedDemo(): Promise<number> {
  const hash = await bcrypt.hash("demo1234", 10);
  const today = localDay();
  const ids: string[] = [];

  for (const d of DEMO) {
    const email = `${d.name.split(" ")[0].toLowerCase()}@demo.dream2role`;
    if (db.byEmail(email)) {
      ids.push(db.byEmail(email)!.id);
      continue;
    }
    const role = findRole(d.roleId);
    const levels = Object.fromEntries(role.skills.map((s, i) => [s.id, (i % 3) as SkillLevel]));
    const goal: Goal = { roleId: role.id, roleTitle: role.title, levels, hoursPerWeek: d.hours, deadline: null, createdAt: new Date().toISOString() };
    const user = db.insert({ id: crypto.randomUUID(), name: d.name, email, passwordHash: hash, avatar: d.avatar, createdAt: new Date().toISOString() });
    user.goal = goal;

    // Simulate the last `days` days of study on whichever lesson is next.
    let progress = emptyProgress();
    for (let i = d.days - 1; i >= 0; i--) {
      const lesson = allLessons(buildPath(goal)).find((l) => !l.placedOut && (progress.lessonMinutes[l.id] ?? 0) < l.minutes);
      if (!lesson) break;
      progress = logStudy(goal, progress, lesson.id, 20 + ((i * 17) % 40), addDays(today, -i), dailyGoalMinutes(goal)).progress;
    }
    user.progress = progress;
    ids.push(user.id);
  }

  // Connect a couple of the demo users to each other so "mutual friends" works.
  const [a, b, c] = ids.map((id) => db.byId(id)!);
  for (const [x, y] of [[a, b], [a, c]]) {
    if (!x.friends.includes(y.id)) x.friends.push(y.id);
    if (!y.friends.includes(x.id)) y.friends.push(x.id);
  }
  save();
  return DEMO.length;
}
