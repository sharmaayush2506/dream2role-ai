import { useEffect, useMemo, useState } from "react";
import { localDay } from "../../shared/game.ts";
import { dailyGoalMinutes, roleForGoal } from "../../shared/plan.ts";
import { remindersFor, type Reminder } from "../../shared/reminders.ts";
import type { Me } from "./api.ts";

const PREFS_KEY = "d2r.reminders";

export interface ReminderPrefs {
  enabled: boolean;
  time: string; // HH:MM, local
  lastSent?: string; // YYYY-MM-DD
}

function readPrefs(): ReminderPrefs {
  try {
    return { enabled: false, time: "19:00", ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return { enabled: false, time: "19:00" };
  }
}

function writePrefs(p: ReminderPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function useReminders(user: Me) {
  const today = localDay();
  const goal = user.goal!;
  const todayMinutes = user.progress.activity.find((a) => a.date === today)?.minutes ?? 0;
  const dailyGoal = dailyGoalMinutes(goal);

  const reminders: Reminder[] = useMemo(
    () =>
      remindersFor({
        name: user.name,
        roleTitle: roleForGoal(goal).title,
        progress: user.progress,
        todayMinutes,
        dailyGoal,
        today,
        seed: Number(today.replaceAll("-", "")),
      }),
    [user, today],
  );

  const [prefs, setPrefsState] = useState<ReminderPrefs>(readPrefs);
  const setPrefs = (p: ReminderPrefs) => {
    writePrefs(p);
    setPrefsState(p);
  };

  // While the app is open, fire a browser notification once a day at the chosen time
  // if today's goal isn't done yet.
  useEffect(() => {
    if (!prefs.enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const latest = readPrefs();
      if (hhmm < prefs.time || latest.lastSent === localDay() || todayMinutes >= dailyGoal) return;
      const r = reminders[0] ?? { emoji: "🚀", title: "Time for a lesson!", body: "Your dream job won't learn itself." };
      new Notification(`${r.emoji} ${r.title}`, { body: r.body, tag: "d2r-daily" });
      setPrefs({ ...latest, lastSent: localDay() });
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [prefs.enabled, prefs.time, todayMinutes, dailyGoal, reminders]);

  async function enable(time: string) {
    if (typeof Notification === "undefined") return setPrefs({ ...prefs, enabled: true, time });
    const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setPrefs({ ...prefs, enabled: perm === "granted", time });
    return perm;
  }

  return { reminders, prefs, enable, disable: () => setPrefs({ ...prefs, enabled: false }), setTime: (time: string) => setPrefs({ ...prefs, time }) };
}
