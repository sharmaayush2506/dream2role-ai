import { liveStreak, streakAtRisk, type Progress } from "./game.ts";

export interface Reminder {
  id: string;
  emoji: string;
  title: string;
  body: string;
}

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

/**
 * Playful nudges based on where the learner stands today.
 * `seed` keeps the wording stable for a given day instead of reshuffling on every render.
 */
export function remindersFor(opts: {
  name: string;
  roleTitle: string;
  progress: Progress;
  todayMinutes: number;
  dailyGoal: number;
  today: string;
  seed: number;
}): Reminder[] {
  const { name, roleTitle, progress, todayMinutes, dailyGoal, today, seed } = opts;
  const first = name.split(" ")[0];
  const out: Reminder[] = [];
  const streak = liveStreak(progress, today);

  if (streakAtRisk(progress, today) && todayMinutes === 0) {
    out.push({
      id: "streak-risk",
      emoji: "🔥",
      title: `Your ${progress.streak}-day streak is getting nervous`,
      body: pick(
        [
          `It's pacing around the room, ${first}. One quick lesson will calm it down.`,
          "Streaks are like houseplants. Water it with 10 minutes today! 🪴",
          `Rolo the rocket refuses to launch without you, ${first}. 🚀`,
        ],
        seed,
      ),
    });
  } else if (progress.lastActiveDate && streak === 0 && todayMinutes === 0) {
    out.push({
      id: "comeback",
      emoji: "🥺",
      title: "We miss you!",
      body: pick(
        [
          `Your future ${roleTitle} self sent a postcard: "Please come back."`,
          "Every legend has a comeback arc. Start yours with one lesson.",
          "Your streak counter is at zero and feeling dramatic about it.",
        ],
        seed,
      ),
    });
  } else if (!progress.lastActiveDate) {
    out.push({
      id: "first-lesson",
      emoji: "🌱",
      title: "Your first lesson is waiting",
      body: `Every ${roleTitle} started somewhere. Tap the glowing circle to begin!`,
    });
  }

  if (todayMinutes > 0 && todayMinutes < dailyGoal) {
    out.push({
      id: "daily-goal",
      emoji: "🎯",
      title: `${dailyGoal - todayMinutes} minutes to today's goal`,
      body: pick(
        ["So close you can smell the XP. 👃", "Finish strong. Your progress bar is begging.", "That's like two songs' worth of studying. 🎧"],
        seed,
      ),
    });
  } else if (todayMinutes >= dailyGoal) {
    out.push({
      id: "goal-done",
      emoji: "🏅",
      title: "Daily goal smashed!",
      body: pick(["Take a bow. Or do a bonus lesson. Your call. 😎", "You're officially on fire today. 🔥"], seed),
    });
  }

  if (streak > 0 && [3, 7, 14, 30, 50, 100].includes(streak)) {
    out.push({ id: "milestone", emoji: "🎉", title: `${streak}-day streak!`, body: "Look at you, building habits like a pro." });
  }

  return out;
}
