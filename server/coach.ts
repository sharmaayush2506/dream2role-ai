// "Rolo", the AI coach: a chat assistant that knows the learner's plan and progress.
import type { Express } from "express";
import type { UserRecord } from "./db.ts";
import { HttpError, limiter, requireAuth, todayFor, userOf } from "./http.ts";
import { aiEnabled, explainAiError, streamChat } from "./ai.ts";
import { buildPath, dailyGoalMinutes, estimate, nextStep, roleForGoal } from "../shared/plan.ts";
import { levelInfo, liveStreak, weekSummary } from "../shared/game.ts";
import { careerReadiness } from "../shared/certs.ts";

const takeChat = limiter("coach", 60, 60 * 60 * 1000);
const MAX_TURNS = 12;
const MAX_CHARS = 2000;

import type { ChatMessage } from "./ai.ts";

/** A snapshot of where the learner stands, so answers are about *their* plan. */
function learnerContext(user: UserRecord, today: string): string {
  const goal = user.goal;
  if (!goal) return `Learner: ${user.name}. They haven't picked a dream job yet.`;
  const role = roleForGoal(goal);
  const path = buildPath(goal);
  const lm = user.progress.lessonMinutes;
  const est = estimate(goal, lm, today);
  const step = nextStep(path, lm, user.progress.passedTests);
  const week = weekSummary(user.progress.activity, today);
  const lvl = levelInfo(user.progress.xp);
  const readiness = careerReadiness(goal, user.progress.passedTests);
  const next =
    step?.kind === "lesson"
      ? `the lesson "${path.flatMap((u) => u.lessons).find((l) => l.id === step.id)?.title}" in ${role.skills.find((s) => s.id === step.skillId)?.name}`
      : step?.kind === "test"
        ? `the ${role.skills.find((s) => s.id === step.skillId)?.name} level test (compulsory to unlock the next level)`
        : "nothing: every level is complete";

  const skills = path
    .map((u) => {
      const total = u.lessons.reduce((s, l) => s + l.minutes, 0);
      const done = u.lessons.reduce((s, l) => s + (l.placedOut ? l.minutes : Math.min(l.minutes, lm[l.id] ?? 0)), 0);
      const topics = u.lessons.map((l) => l.title).join(", ");
      return `- ${u.skill.name} (${Math.round((done / total) * 100)}% done${user.progress.passedTests[u.skill.id] ? ", level test passed" : ""}). Topics: ${topics}`;
    })
    .join("\n");

  return [
    `Learner: ${user.name}. Dream job: ${role.title}.`,
    `Plan: ${goal.hoursPerWeek} hours/week, daily goal ${dailyGoalMinutes(goal)} minutes. ${est.remainingHours}h left, about ${est.weeksNeeded} weeks, estimated finish ${est.finishDate}.` +
      (goal.deadline ? ` Deadline ${goal.deadline} (${est.onTrack ? "on track" : `behind; needs ${est.hoursPerWeekForDeadline} h/week`}).` : ""),
    `This week: ${week.minutes} minutes studied on ${week.activeDays} days. Streak: ${liveStreak(user.progress, today)} days. Level ${lvl.level} (${lvl.title}), ${user.progress.xp} XP.`,
    `Next step in the app: ${next}.`,
    `Skills (levels in order):\n${skills}`,
    `Certificates earned: ${user.certificates.map((c) => c.title).join(", ") || "none yet"}. ` +
      `Level tests passed: ${readiness.passed}/${readiness.total}. Career hub: internship matches, project ideas and the resume builder are all open, no tests needed.`,
  ].join("\n");
}

const INSTRUCTIONS = `You are Rolo, the friendly rocket-mascot AI coach inside Dream2Role, a Duolingo-style app that helps people reach their dream job.
You help the learner understand topics on their path, plan their study time, prepare for level tests, think through projects, and get ready for internships.
Style: warm, upbeat and concise (usually under 150 words), with an occasional emoji. Use short lists for steps. Explain concepts simply with a small example when useful.
Ground advice in the learner's context below. When it helps, point them to the right part of the app: the learning path, the compulsory level tests, the Certificates panel (₹299 each or ₹699 for 3), the Career hub (internships, AI project ideas, AI resume builder) or the Friends zone.
Never give away exact answers to their level tests or certification exams. Teach the concept instead.
If asked about something unrelated to learning or careers, briefly steer back.`;

function cleanHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) throw new HttpError(400, "Invalid messages");
  const msgs = raw
    .filter((m): m is ChatMessage => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_TURNS);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") throw new HttpError(400, "Send a message first");
  return msgs;
}

export function registerCoachRoutes(app: Express) {
  // Streams the reply back as plain text chunks.
  app.post("/api/coach", requireAuth, async (req, res) => {
    const user = userOf(req);
    const messages = cleanHistory(req.body?.messages);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");

    if (!aiEnabled) {
      res.end(
        "🚀 I'm Rolo, your AI coach! I'm not connected to my brain yet: the app owner needs to add a GEMINI_API_KEY (or OPENAI_API_KEY) on the server. " +
          "Until then, keep going on your learning path. Every lesson counts! 💪",
      );
      return;
    }
    takeChat(user.id);

    try {
      await streamChat(
        `${INSTRUCTIONS}\n\n<learner_context>\n${learnerContext(user, todayFor(req))}\n</learner_context>`,
        messages,
        (delta) => res.write(delta),
      );
      res.end();
    } catch (err) {
      const reason = explainAiError(err);
      console.error("Coach request failed:", reason);
      if (!res.headersSent) throw new HttpError(502, `Rolo couldn't answer: ${reason}`);
      res.end("\n\n😵 Sorry, I lost my train of thought. Try asking again.");
    }
  });
}
