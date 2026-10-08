// Level tests, certifications, payments and AI career tools.
import crypto from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { db, save, type PendingTest, type UserRecord } from "./db.ts";
import { HttpError, limiter, rateLimit, requireAuth, todayFor, userOf } from "./http.ts";
import { selfView } from "./views.ts";
import { aiEnabled, buildResume, generateQuiz, ResumeInputSchema, roadmapInsight, suggestInternships, suggestProjects, type LearnerProfile } from "./ai.ts";
import { confirmPayment, createOrder } from "./payments.ts";
import { buildPath, estimate, LEVEL_LABELS, lessonDone, roleForGoal } from "../shared/plan.ts";
import { awardXp, LEVEL_TEST_XP, type GameEvent } from "../shared/game.ts";
import { careerReadiness, CERT_TEST, certEligible, certsForGoal, LEVEL_TEST, type Pack } from "../shared/certs.ts";

const HOUR = 60 * 60 * 1000;

function goalOf(user: UserRecord) {
  if (!user.goal) throw new HttpError(400, "Set your dream job first");
  return user.goal;
}

function learnerProfile(user: UserRecord): LearnerProfile {
  const goal = goalOf(user);
  const lm = user.progress.lessonMinutes;
  return {
    roleTitle: roleForGoal(goal).title,
    skills: buildPath(goal).map((u) => {
      const total = u.lessons.reduce((s, l) => s + l.minutes, 0);
      const done = u.lessons.reduce((s, l) => s + (l.placedOut ? l.minutes : Math.min(l.minutes, lm[l.id] ?? 0)), 0);
      return { name: u.skill.name, percent: Math.round((done / total) * 100), testPassed: !!user.progress.passedTests[u.skill.id] };
    }),
    certificates: user.certificates.map((c) => c.title),
  };
}

/** Questions as the client sees them: no answers until each one is locked in. */
function publicTest(t: PendingTest) {
  return {
    testId: t.id,
    kind: t.kind,
    title: t.title,
    source: t.source,
    passPercent: t.kind === "level" ? LEVEL_TEST.passPercent : CERT_TEST.passPercent,
    questions: t.questions.map((q) => ({ question: q.question, options: q.options })),
    answers: t.answers,
    correctSoFar: t.answers.filter((a, i) => a === t.questions[i].answerIndex).length,
  };
}

function certificateId() {
  const part = () => crypto.randomBytes(3).toString("hex").toUpperCase();
  return `D2R-${part()}-${part()}`;
}

// Only real AI calls cost money, so only they count toward the limits.
const takeQuizGeneration = limiter("quiz", 30, HOUR);
const takeCareerCall = limiter("career", 15, HOUR);
const aiLimit = (req: Request, _res: Response, next: NextFunction) => {
  if (aiEnabled) takeCareerCall(userOf(req).id);
  next();
};

/** Quizzes being generated right now, so simultaneous starts share one generation. */
const generating = new Map<string, Promise<PendingTest>>();

export function registerCareerRoutes(app: Express) {
  // ---------- Tests ----------
  app.post("/api/tests/start", requireAuth, async (req, res) => {
    const user = userOf(req);
    const goal = goalOf(user);
    const role = roleForGoal(goal);
    const kind = req.body?.kind === "cert" ? "cert" : "level";
    const ref = String(req.body?.ref ?? "");
    let title: string;
    let skills: { name: string; topics: string[] }[];

    if (kind === "level") {
      const unit = buildPath(goal).find((u) => u.skill.id === ref);
      if (!unit) throw new HttpError(404, "Level not found");
      if (user.progress.passedTests[ref]) throw new HttpError(400, "You already passed this level");
      if (!unit.lessons.every((l) => lessonDone(l, user.progress.lessonMinutes)))
        throw new HttpError(400, "Finish every lesson in this level first");
      title = `${unit.skill.name} level test`;
      skills = [{ name: unit.skill.name, topics: unit.skill.topics }];
    } else {
      const cert = certsForGoal(goal).find((c) => c.id === ref);
      if (!cert) throw new HttpError(404, "Certificate not found");
      if (!user.unlockedCerts.includes(cert.id)) throw new HttpError(402, "Unlock this certificate first");
      if (user.certificates.some((c) => c.certId === cert.id)) throw new HttpError(400, "You already earned this certificate");
      title = `${cert.title} exam`;
      skills = role.skills.filter((s) => cert.requires.includes(s.id)).map((s) => ({ name: s.name, topics: s.topics }));
    }

    // Reopening a test picks up the attempt already in progress instead of making a new one.
    const existing = Object.values(user.tests).find((t) => t.ref === ref);
    if (existing) return void res.json(publicTest(existing));

    const key = `${user.id}:${ref}`;
    let job = generating.get(key);
    if (!job) {
      if (aiEnabled) takeQuizGeneration(user.id);
      const spec = kind === "level" ? LEVEL_TEST : CERT_TEST;
      job = generateQuiz({ roleTitle: role.title, skills, count: spec.questions, difficulty: kind === "level" ? "level" : "certification" })
        .then(({ data: questions, source }) => {
          const test: PendingTest = {
            id: crypto.randomUUID(),
            kind,
            ref,
            title,
            questions,
            answers: questions.map(() => null),
            source,
            createdAt: new Date().toISOString(),
          };
          user.tests[test.id] = test;
          save();
          return test;
        })
        .finally(() => generating.delete(key));
      generating.set(key, job);
    }
    res.json(publicTest(await job));
  });

  function pending(user: UserRecord, id: string) {
    const t = user.tests[id];
    if (!t) throw new HttpError(404, "Test not found. Start it again.");
    return t;
  }

  app.post("/api/tests/:id/answer", requireAuth, (req, res) => {
    const test = pending(userOf(req), String(req.params.id));
    const index = Number(req.body?.index);
    const choice = Number(req.body?.choice);
    const q = test.questions[index];
    if (!q || ![0, 1, 2, 3].includes(choice)) throw new HttpError(400, "Invalid answer");
    if (test.answers[index] !== null) throw new HttpError(400, "You already answered this question");
    test.answers[index] = choice;
    save();
    res.json({ correct: choice === q.answerIndex, answerIndex: q.answerIndex, explanation: q.explanation });
  });

  app.post("/api/tests/:id/finish", requireAuth, (req, res) => {
    const user = userOf(req);
    const test = pending(user, String(req.params.id));
    if (test.answers.some((a) => a === null)) throw new HttpError(400, "Answer every question first");
    const today = todayFor(req);
    const score = test.answers.filter((a, i) => a === test.questions[i].answerIndex).length;
    const total = test.questions.length;
    const passPercent = test.kind === "level" ? LEVEL_TEST.passPercent : CERT_TEST.passPercent;
    const passed = (score / total) * 100 >= passPercent;
    let events: GameEvent[] = [];
    let certificate = null;

    if (passed && test.kind === "level") {
      const unit = buildPath(goalOf(user)).find((u) => u.skill.id === test.ref)!;
      user.progress.passedTests[test.ref] = { score, total, passedAt: new Date().toISOString() };
      const r = awardXp(user.progress, LEVEL_TEST_XP, today);
      user.progress = r.progress;
      events = [...r.events, { type: "test-passed", name: unit.skill.name, score, total }];
    }
    if (passed && test.kind === "cert") {
      const cert = certsForGoal(goalOf(user)).find((c) => c.id === test.ref)!;
      certificate = {
        id: certificateId(),
        certId: cert.id,
        title: cert.title,
        roleTitle: roleForGoal(goalOf(user)).title,
        score,
        total,
        issuedAt: new Date().toISOString(),
      };
      user.certificates.push(certificate);
      events = [{ type: "certificate", title: cert.title }];
    }

    delete user.tests[test.id];
    save();
    res.json({ score, total, passed, passPercent, events, certificate, user: selfView(user, today) });
  });

  // ---------- Certificates ----------
  app.post("/api/certs/:certId/unlock", requireAuth, (req, res) => {
    const user = userOf(req);
    const cert = certsForGoal(goalOf(user)).find((c) => c.id === req.params.certId);
    if (!cert) throw new HttpError(404, "Certificate not found");
    if (!certEligible(cert, user.progress.passedTests)) throw new HttpError(403, `Pass the level ${cert.level} test to unlock this certificate`);
    if (!user.unlockedCerts.includes(cert.id)) {
      if (user.certCredits < 1) throw new HttpError(402, "Buy a certificate to unlock this exam");
      user.certCredits -= 1;
      user.unlockedCerts.push(cert.id);
      save();
    }
    res.json({ user: selfView(user, todayFor(req)) });
  });

  // Public: anyone with the ID can verify a certificate.
  app.get("/api/certificates/:id", (req, res) => {
    const found = db.certificate(String(req.params.id));
    if (!found) throw new HttpError(404, "No certificate with that ID");
    const { user, cert } = found;
    res.json({ ...cert, name: user.name });
  });

  // ---------- Payments ----------
  app.post("/api/payments/order", requireAuth, rateLimit("order", 20, HOUR), async (req, res) => {
    const pack: Pack = req.body?.pack === "bundle" ? "bundle" : "single";
    const order = await createOrder(userOf(req), pack);
    save();
    res.json(order);
  });

  app.post("/api/payments/verify", requireAuth, (req, res) => {
    const user = userOf(req);
    const order = confirmPayment(user, String(req.body?.orderId ?? ""), String(req.body?.paymentId ?? ""), String(req.body?.signature ?? ""));
    save();
    res.json({ credits: order.credits, user: selfView(user, todayFor(req)) });
  });

  // ---------- AI career tools ----------
  app.get("/api/career", requireAuth, (req, res) => {
    const user = userOf(req);
    res.json({ readiness: careerReadiness(goalOf(user), user.progress.passedTests), cache: user.careerCache });
  });


  // A short AI read of the learner's (just saved) roadmap, shown on the plan screen.
  app.post("/api/plan/insight", requireAuth, aiLimit, async (req, res) => {
    const user = userOf(req);
    const goal = goalOf(user);
    const est = estimate(goal, user.progress.lessonMinutes, todayFor(req));
    const lm = user.progress.lessonMinutes;
    const out = await roadmapInsight({
      roleTitle: roleForGoal(goal).title,
      hoursPerWeek: goal.hoursPerWeek,
      weeksNeeded: est.weeksNeeded,
      finishDate: est.finishDate,
      deadline: est.deadline,
      onTrack: est.onTrack,
      skills: buildPath(goal).map((u) => ({
        name: u.skill.name,
        level: LEVEL_LABELS[goal.levels[u.skill.id] ?? 0].label,
        hoursLeft: Math.round(u.lessons.reduce((s, l) => s + (l.placedOut ? 0 : Math.max(0, l.minutes - (lm[l.id] ?? 0))), 0) / 60),
      })),
    });
    res.json(out);
  });

  app.post("/api/career/internships", requireAuth, aiLimit, async (req, res) => {
    const user = userOf(req);
    const r = careerReadiness(goalOf(user), user.progress.passedTests);
    if (!r.internshipsUnlocked) throw new HttpError(403, `Pass ${r.internshipsAt} level tests to unlock internship matches`);
    const out = await suggestInternships(learnerProfile(user));
    user.careerCache.internships = { ...out, at: new Date().toISOString() };
    save();
    res.json(user.careerCache.internships);
  });

  app.post("/api/career/projects", requireAuth, aiLimit, async (req, res) => {
    const user = userOf(req);
    if (!careerReadiness(goalOf(user), user.progress.passedTests).projectsUnlocked)
      throw new HttpError(403, "Pass your first level test to unlock project ideas");
    const interests = String(req.body?.interests ?? "").slice(0, 300);
    const out = await suggestProjects(learnerProfile(user), interests);
    user.careerCache.projects = { ...out, at: new Date().toISOString() };
    save();
    res.json(user.careerCache.projects);
  });

  app.post("/api/career/resume", requireAuth, aiLimit, async (req, res) => {
    const user = userOf(req);
    const parsed = ResumeInputSchema.safeParse(req.body?.input);
    if (!parsed.success) throw new HttpError(400, "Please fill in your name, email, target internship and education");
    if (!parsed.data.fullName.trim() || !parsed.data.targetInternship.trim() || !parsed.data.education.trim())
      throw new HttpError(400, "Please fill in your name, target internship and education");
    const out = await buildResume(parsed.data, learnerProfile(user));
    const entry = { data: { resume: out.data, input: parsed.data }, source: out.source, aiError: out.aiError, at: new Date().toISOString() };
    user.careerCache.resume = entry;
    save();
    res.json(entry);
  });
}
