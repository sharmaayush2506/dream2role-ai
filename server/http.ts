import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db, type UserRecord } from "./db.ts";
import { daysBetween, formatDay } from "../shared/plan.ts";

const JWT_SECRET = process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-only-secret-change-me");
if (!JWT_SECRET) throw new Error("JWT_SECRET must be set in production");

export interface AuthedRequest extends Request {
  user: UserRecord;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function sign(user: UserRecord) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) throw new HttpError(401, "Please log in");
  try {
    const { sub } = jwt.verify(token, JWT_SECRET) as { sub: string };
    const user = db.byId(sub);
    if (!user) throw new Error();
    (req as AuthedRequest).user = user;
    next();
  } catch {
    throw new HttpError(401, "Your session expired. Please log in again.");
  }
}

export const userOf = (req: Request) => (req as AuthedRequest).user;

/** Use the client's local date (so streaks follow their timezone), as long as it's plausible. */
export function todayFor(req: Request): string {
  const serverToday = formatDay(new Date());
  const t = String(req.query.today ?? req.body?.today ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && Math.abs(daysBetween(serverToday, t)) <= 1 ? t : serverToday;
}

/** Per-user limiter for expensive work (AI calls). `take` throws once the user is over the limit. */
export function limiter(name: string, max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function take(userId: string) {
    const key = `${name}:${userId}`;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      const minutes = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 60_000));
      throw new HttpError(429, `Whoa, slow down! Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`);
    }
    recent.push(now);
    hits.set(key, recent);
  };
}

/** The same limiter as Express middleware, for routes where every call is expensive. */
export function rateLimit(name: string, max: number, windowMs: number) {
  const take = limiter(name, max, windowMs);
  return (req: Request, _res: Response, next: NextFunction) => {
    take(userOf(req).id);
    next();
  };
}
