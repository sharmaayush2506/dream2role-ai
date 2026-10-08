import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, save, type UserRecord } from "./db.ts";
import { findRole, ROLES } from "../shared/catalog.ts";
import { buildPath, dailyGoalMinutes, daysBetween, estimate, formatDay, type Goal, type SkillLevel } from "../shared/plan.ts";
import { levelInfo, liveStreak, logStudy, weekSummary } from "../shared/game.ts";

const JWT_SECRET = process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-only-secret-change-me");
if (!JWT_SECRET) throw new Error("JWT_SECRET must be set in production");

const AVATARS = ["🦊", "🐼", "🐯", "🐸", "🐵", "🦁", "🐨", "🐙", "🦄", "🐧", "🐢", "🦉"];

interface AuthedRequest extends Request {
  user: UserRecord;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sign(user: UserRecord) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(req: Request, _res: Response, next: NextFunction) {
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

/** Use the client's local date (so streaks follow their timezone), as long as it's plausible. */
function todayFor(req: Request): string {
  const serverToday = formatDay(new Date());
  const t = String(req.query.today ?? req.body?.today ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && Math.abs(daysBetween(serverToday, t)) <= 1 ? t : serverToday;
}

function selfView(u: UserRecord, today: string) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    goal: u.goal,
    progress: { ...u.progress, streak: liveStreak(u.progress, today) },
    incomingCount: u.incoming.length,
  };
}

/** What friends get to see: weekly progress, streak and level. */
function friendCard(u: UserRecord, today: string) {
  const role = u.goal ? findRole(u.goal.roleId, u.goal.roleTitle) : null;
  const lvl = levelInfo(u.progress.xp);
  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    roleTitle: role?.title ?? null,
    roleEmoji: role?.emoji ?? null,
    level: lvl.level,
    levelTitle: lvl.title,
    xp: u.progress.xp,
    streak: liveStreak(u.progress, today),
    week: weekSummary(u.progress.activity, today),
    weeklyGoalMinutes: u.goal ? u.goal.hoursPerWeek * 60 : null,
    percentDone: u.goal ? estimate(u.goal, u.progress.lessonMinutes, today).percentDone : 0,
  };
}

/** What strangers get to see: just enough to decide whether to add them. */
function publicCard(u: UserRecord, reason?: string) {
  const role = u.goal ? findRole(u.goal.roleId, u.goal.roleTitle) : null;
  return { id: u.id, name: u.name, avatar: u.avatar, roleTitle: role?.title ?? null, roleEmoji: role?.emoji ?? null, reason };
}

function parseGoal(body: unknown): Goal {
  const b = (body ?? {}) as Record<string, unknown>;
  const roleId = String(b.roleId ?? "");
  const roleTitle = String(b.roleTitle ?? "").trim().slice(0, 60);
  if (roleId !== "custom" && !ROLES.some((r) => r.id === roleId)) throw new HttpError(400, "Pick a dream job");
  if (roleId === "custom" && !roleTitle) throw new HttpError(400, "Tell us your dream job");
  const role = findRole(roleId, roleTitle);

  const rawLevels = (b.levels ?? {}) as Record<string, unknown>;
  const levels: Record<string, SkillLevel> = {};
  for (const s of role.skills) {
    const n = Number(rawLevels[s.id] ?? 0);
    levels[s.id] = ([0, 1, 2, 3].includes(n) ? n : 0) as SkillLevel;
  }

  const hoursPerWeek = Number(b.hoursPerWeek);
  if (!Number.isFinite(hoursPerWeek) || hoursPerWeek < 1 || hoursPerWeek > 80)
    throw new HttpError(400, "Weekly time must be between 1 and 80 hours");

  const deadline = b.deadline ? String(b.deadline) : null;
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw new HttpError(400, "Invalid deadline");

  return { roleId: role.id, roleTitle: role.title, levels, hoursPerWeek, deadline, createdAt: new Date().toISOString() };
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "50kb" }));

  // ---------- Auth ----------
  app.post("/api/auth/signup", async (req, res) => {
    const name = String(req.body?.name ?? "").trim().slice(0, 40);
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!name) throw new HttpError(400, "What should we call you?");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "That email doesn't look right");
    if (password.length < 8) throw new HttpError(400, "Password needs at least 8 characters");
    if (db.byEmail(email)) throw new HttpError(409, "An account with that email already exists");

    const user = db.insert({
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      avatar: AVATARS[crypto.randomInt(AVATARS.length)],
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ token: sign(user), user: selfView(user, todayFor(req)) });
  });

  app.post("/api/auth/login", async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const user = db.byEmail(email);
    const ok = user && (await bcrypt.compare(String(req.body?.password ?? ""), user.passwordHash));
    if (!user || !ok) throw new HttpError(401, "Wrong email or password");
    res.json({ token: sign(user), user: selfView(user, todayFor(req)) });
  });

  app.get("/api/me", requireAuth, (req, res) => {
    res.json({ user: selfView((req as AuthedRequest).user, todayFor(req)) });
  });

  // ---------- Goal & study ----------
  app.put("/api/goal", requireAuth, (req, res) => {
    const user = (req as AuthedRequest).user;
    const goal = parseGoal(req.body);
    // Changing to a different dream job starts a fresh path; XP and streak are kept.
    if (user.goal && user.goal.roleId !== goal.roleId) user.progress.lessonMinutes = {};
    user.goal = goal;
    save();
    res.json({ user: selfView(user, todayFor(req)) });
  });

  app.post("/api/study", requireAuth, (req, res) => {
    const user = (req as AuthedRequest).user;
    if (!user.goal) throw new HttpError(400, "Set your dream job first");
    const minutes = Math.round(Number(req.body?.minutes));
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 240) throw new HttpError(400, "Log between 5 and 240 minutes");
    const lessonId = String(req.body?.lessonId ?? "");
    const lesson = buildPath(user.goal).flatMap((u) => u.lessons).find((l) => l.id === lessonId);
    if (!lesson) throw new HttpError(404, "Lesson not found");

    const today = todayFor(req);
    const { progress, events } = logStudy(user.goal, user.progress, lessonId, minutes, today, dailyGoalMinutes(user.goal));
    user.progress = progress;
    save();
    res.json({ user: selfView(user, today), events });
  });

  // ---------- Friends ----------
  app.get("/api/friends", requireAuth, (req, res) => {
    const user = (req as AuthedRequest).user;
    const today = todayFor(req);
    const cards = (ids: string[]) => ids.map((id) => db.byId(id)).filter((u): u is UserRecord => !!u);
    res.json({
      me: friendCard(user, today),
      friends: cards(user.friends).map((u) => friendCard(u, today)),
      incoming: cards(user.incoming).map((u) => publicCard(u)),
      outgoing: cards(user.outgoing).map((u) => publicCard(u)),
    });
  });

  app.get("/api/friends/suggestions", requireAuth, (req, res) => {
    const user = (req as AuthedRequest).user;
    const today = todayFor(req);
    const exclude = new Set([user.id, ...user.friends, ...user.outgoing, ...user.incoming]);
    const mySkills = new Set(user.goal ? findRole(user.goal.roleId, user.goal.roleTitle).skills.map((s) => s.id) : []);
    const scored = db
      .users()
      .filter((u) => !exclude.has(u.id))
      .map((u) => {
        let score = 0;
        let reason = "Also learning on Dream2Role";
        const mutual = u.friends.filter((f) => user.friends.includes(f)).length;
        if (mutual) {
          score += mutual * 2;
          reason = `${mutual} mutual friend${mutual > 1 ? "s" : ""}`;
        }
        if (u.goal && user.goal) {
          const shared = findRole(u.goal.roleId, u.goal.roleTitle).skills.filter((s) => mySkills.has(s.id)).length;
          if (u.goal.roleId === user.goal.roleId && u.goal.roleId !== "custom") {
            score += 5;
            reason = `Also wants to be a ${u.goal.roleTitle}`;
          } else if (shared) {
            score += shared;
            if (!mutual) reason = `Learning ${shared} of the same skills`;
          }
        }
        if (liveStreak(u.progress, today) > 0) score += 1;
        return { u, score, reason };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    res.json({ suggestions: scored.map(({ u, reason }) => publicCard(u, reason)) });
  });

  app.get("/api/users/search", requireAuth, (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = String(req.query.q ?? "").trim().toLowerCase();
    if (q.length < 2) return void res.json({ results: [] });
    const results = db
      .users()
      .filter((u) => u.id !== user.id && (u.name.toLowerCase().includes(q) || u.email === q))
      .slice(0, 10)
      .map((u) => ({ ...publicCard(u), status: user.friends.includes(u.id) ? "friend" : user.outgoing.includes(u.id) ? "requested" : user.incoming.includes(u.id) ? "incoming" : "none" }));
    res.json({ results });
  });

  function other(req: Request) {
    const target = db.byId(String(req.body?.userId ?? req.params.id ?? ""));
    if (!target || target.id === (req as AuthedRequest).user.id) throw new HttpError(404, "User not found");
    return target;
  }
  const without = (list: string[], id: string) => list.filter((x) => x !== id);

  function befriend(a: UserRecord, b: UserRecord) {
    a.incoming = without(a.incoming, b.id);
    a.outgoing = without(a.outgoing, b.id);
    b.incoming = without(b.incoming, a.id);
    b.outgoing = without(b.outgoing, a.id);
    if (!a.friends.includes(b.id)) a.friends.push(b.id);
    if (!b.friends.includes(a.id)) b.friends.push(a.id);
  }

  app.post("/api/friends/request", requireAuth, (req, res) => {
    const me = (req as AuthedRequest).user;
    const them = other(req);
    if (me.incoming.includes(them.id)) befriend(me, them); // they already asked: just connect
    else if (!me.friends.includes(them.id) && !me.outgoing.includes(them.id)) {
      me.outgoing.push(them.id);
      them.incoming.push(me.id);
    }
    save();
    res.json({ ok: true });
  });

  app.post("/api/friends/accept", requireAuth, (req, res) => {
    const me = (req as AuthedRequest).user;
    const them = other(req);
    if (!me.incoming.includes(them.id)) throw new HttpError(400, "No pending request from this user");
    befriend(me, them);
    save();
    res.json({ ok: true });
  });

  app.post("/api/friends/decline", requireAuth, (req, res) => {
    const me = (req as AuthedRequest).user;
    const them = other(req);
    me.incoming = without(me.incoming, them.id);
    them.outgoing = without(them.outgoing, me.id);
    save();
    res.json({ ok: true });
  });

  app.delete("/api/friends/:id", requireAuth, (req, res) => {
    const me = (req as AuthedRequest).user;
    const them = other(req);
    me.friends = without(me.friends, them.id);
    them.friends = without(them.friends, me.id);
    me.outgoing = without(me.outgoing, them.id);
    them.incoming = without(them.incoming, me.id);
    save();
    res.json({ ok: true });
  });

  app.use("/api", (_req, _res) => {
    throw new HttpError(404, "Not found");
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
