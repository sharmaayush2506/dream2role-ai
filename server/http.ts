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

/** Simple per-user limiter for expensive endpoints (AI calls). */
export function rateLimit(name: string, max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `${name}:${userOf(req).id}`;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) throw new HttpError(429, "Whoa, slow down! Try again in a few minutes.");
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
