import type { Goal } from "../../shared/plan.ts";
import type { GameEvent, Progress, WeekSummary } from "../../shared/game.ts";
import { localDay } from "../../shared/game.ts";

export interface Me {
  id: string;
  name: string;
  email: string;
  avatar: string;
  goal: Goal | null;
  progress: Progress;
  incomingCount: number;
}

export interface PublicCard {
  id: string;
  name: string;
  avatar: string;
  roleTitle: string | null;
  roleEmoji: string | null;
  reason?: string;
  status?: "friend" | "requested" | "incoming" | "none";
}

export interface FriendCard extends PublicCard {
  level: number;
  levelTitle: string;
  xp: number;
  streak: number;
  week: WeekSummary;
  weeklyGoalMinutes: number | null;
  percentDone: number;
}

const TOKEN_KEY = "d2r.token";

export const token = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`/api${path}${sep}today=${localDay()}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token.get() ? { Authorization: `Bearer ${token.get()}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify({ ...(body as object), today: localDay() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong");
  return data as T;
}

export const api = {
  signup: (name: string, email: string, password: string) =>
    request<{ token: string; user: Me }>("POST", "/auth/signup", { name, email, password }),
  login: (email: string, password: string) => request<{ token: string; user: Me }>("POST", "/auth/login", { email, password }),
  me: () => request<{ user: Me }>("GET", "/me"),
  saveGoal: (goal: Omit<Goal, "createdAt">) => request<{ user: Me }>("PUT", "/goal", goal),
  study: (lessonId: string, minutes: number) =>
    request<{ user: Me; events: GameEvent[] }>("POST", "/study", { lessonId, minutes }),
  friends: () =>
    request<{ me: FriendCard; friends: FriendCard[]; incoming: PublicCard[]; outgoing: PublicCard[] }>("GET", "/friends"),
  suggestions: () => request<{ suggestions: PublicCard[] }>("GET", "/friends/suggestions"),
  search: (q: string) => request<{ results: PublicCard[] }>("GET", `/users/search?q=${encodeURIComponent(q)}`),
  addFriend: (userId: string) => request("POST", "/friends/request", { userId }),
  accept: (userId: string) => request("POST", "/friends/accept", { userId }),
  decline: (userId: string) => request("POST", "/friends/decline", { userId }),
  unfriend: (userId: string) => request("DELETE", `/friends/${userId}`),
};
