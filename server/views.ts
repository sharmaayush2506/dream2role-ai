import type { UserRecord } from "./db.ts";
import { liveStreak } from "../shared/game.ts";
import { aiEnabled } from "./ai.ts";
import { paymentMode } from "./payments.ts";

/** Everything the signed-in user sees about themselves. */
export function selfView(u: UserRecord, today: string) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    goal: u.goal,
    progress: { ...u.progress, streak: liveStreak(u.progress, today) },
    incomingCount: u.incoming.length,
    certCredits: u.certCredits,
    unlockedCerts: u.unlockedCerts,
    certificates: u.certificates,
    features: { ai: aiEnabled, payments: paymentMode },
  };
}
