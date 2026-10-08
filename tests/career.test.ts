import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let base = "";
let close: () => void;
let dbMod: typeof import("../server/db.ts");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d2r-career-"));

beforeAll(async () => {
  process.env.DATA_FILE = path.join(dir, "db.json");
  // Force offline AI so tests never call a real model.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  const { createApp } = await import("../server/app.ts");
  dbMod = await import("../server/db.ts");
  const server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  close = () => server.close();
});
afterAll(() => {
  close();
  fs.rmSync(dir, { recursive: true, force: true });
});

let token = "";
let userId = "";
async function call(method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

/** Answers every question correctly by peeking at the stored answer key. */
async function passTest(kind: "level" | "cert", ref: string) {
  const start = await call("POST", "/tests/start", { kind, ref });
  expect(start.status).toBe(200);
  expect(start.body.questions[0].answerIndex).toBeUndefined(); // answers never sent up front
  const stored = dbMod.db.byId(userId)!.tests[start.body.testId];
  for (let i = 0; i < stored.questions.length; i++) {
    const a = await call("POST", `/tests/${start.body.testId}/answer`, { index: i, choice: stored.questions[i].answerIndex });
    expect(a.body.correct).toBe(true);
  }
  return call("POST", `/tests/${start.body.testId}/finish`, {});
}

describe("levels, tests, certificates and career", () => {
  it("locks the next level until the level test is passed", async () => {
    const s = await call("POST", "/auth/signup", { name: "Cara", email: "cara@x.io", password: "password1" });
    token = s.body.token;
    userId = s.body.user.id;
    // Advanced in every skill: only the last lesson of each level is left.
    const levels = { python: 3, statistics: 3, sql: 3, ml: 3, dataviz: 3, "ds-portfolio": 3 };
    await call("PUT", "/goal", { roleId: "data-scientist", levels, hoursPerWeek: 10 });

    expect((await call("POST", "/study", { lessonId: "statistics:3", minutes: 30 })).status).toBe(403);
    expect((await call("POST", "/tests/start", { kind: "level", ref: "python" })).status).toBe(400); // lessons not done

    for (let i = 0; i < 5; i++) await call("POST", "/study", { lessonId: "python:3", minutes: 240 });
    expect((await call("POST", "/study", { lessonId: "statistics:3", minutes: 30 })).status).toBe(403); // test still needed

    const r = await passTest("level", "python");
    expect(r.body).toMatchObject({ passed: true, score: 8, total: 8 });
    expect(r.body.user.progress.passedTests.python).toBeTruthy();
    expect((await call("POST", "/study", { lessonId: "statistics:3", minutes: 30 })).status).toBe(200);
  });

  it("reopening or double-starting a test resumes the same attempt", async () => {
    for (let i = 0; i < 5; i++) await call("POST", "/study", { lessonId: "statistics:3", minutes: 240 });
    // Two starts at once (React dev mode does this) share one test.
    const [a, b] = await Promise.all([
      call("POST", "/tests/start", { kind: "level", ref: "statistics" }),
      call("POST", "/tests/start", { kind: "level", ref: "statistics" }),
    ]);
    expect(a.body.testId).toBe(b.body.testId);
    const stored = dbMod.db.byId(userId)!.tests[a.body.testId];
    await call("POST", `/tests/${a.body.testId}/answer`, { index: 0, choice: stored.questions[0].answerIndex });
    // Closing and reopening many times never creates a new test or hits a limit.
    for (let i = 0; i < 20; i++) {
      const again = await call("POST", "/tests/start", { kind: "level", ref: "statistics" });
      expect(again.status).toBe(200);
      expect(again.body.testId).toBe(a.body.testId);
      expect(again.body.correctSoFar).toBe(1);
    }
  });

  it("can't re-answer a question, and failing doesn't pass the level", async () => {
    for (let i = 0; i < 5; i++) await call("POST", "/study", { lessonId: "statistics:3", minutes: 240 });
    const start = await call("POST", "/tests/start", { kind: "level", ref: "statistics" });
    const stored = dbMod.db.byId(userId)!.tests[start.body.testId];
    for (let i = 0; i < stored.questions.length; i++) {
      await call("POST", `/tests/${start.body.testId}/answer`, { index: i, choice: (stored.questions[i].answerIndex + 1) % 4 });
    }
    expect((await call("POST", `/tests/${start.body.testId}/answer`, { index: 0, choice: 0 })).status).toBe(400);
    const r = await call("POST", `/tests/${start.body.testId}/finish`, {});
    expect(r.body.passed).toBe(false);
    expect(r.body.user.progress.passedTests.statistics).toBeUndefined();
  });

  it("sells certificate credits and issues a verifiable certificate", async () => {
    const cert = "data-scientist:python";
    expect((await call("POST", `/certs/${cert}/unlock`, {})).status).toBe(402); // no credits
    expect((await call("POST", "/certs/data-scientist:sql/unlock", {})).status).toBe(403); // level not passed

    const order = await call("POST", "/payments/order", { pack: "bundle" });
    expect(order.body).toMatchObject({ provider: "demo", amount: 699, credits: 3 });
    const paid = await call("POST", "/payments/verify", { orderId: order.body.orderId });
    expect(paid.body.user.certCredits).toBe(3);
    await call("POST", "/payments/verify", { orderId: order.body.orderId }); // idempotent
    expect(dbMod.db.byId(userId)!.certCredits).toBe(3);

    const unlocked = await call("POST", `/certs/${cert}/unlock`, {});
    expect(unlocked.body.user.certCredits).toBe(2);
    const r = await passTest("cert", cert);
    expect(r.body.passed).toBe(true);
    expect(r.body.certificate.id).toMatch(/^D2R-/);

    token = "";
    const pub = await call("GET", `/certificates/${r.body.certificate.id}`);
    expect(pub.body).toMatchObject({ name: "Cara", title: "Python Certified" });
    expect(pub.body.email).toBeUndefined();
  });

  it("opens internships and projects to a brand-new learner with no tests passed", async () => {
    token = (await call("POST", "/auth/signup", { name: "Neo", email: "neo@x.io", password: "password1" })).body.token;
    await call("PUT", "/goal", { roleId: "frontend-dev", levels: {}, hoursPerWeek: 5 });
    const career = await call("GET", "/career");
    expect(career.body.readiness.passed).toBe(0);
    expect((await call("POST", "/career/internships", {})).status).toBe(200);
    expect((await call("POST", "/career/projects", { interests: "" })).status).toBe(200);
  });

  it("opens career tools without any tests and builds a resume", async () => {
    token = (await call("POST", "/auth/login", { email: "cara@x.io", password: "password1" })).body.token;
    const internships = await call("POST", "/career/internships", {});
    expect(internships.status).toBe(200);
    expect(internships.body.data.internships.length).toBeGreaterThan(0);
    const projects = await call("POST", "/career/projects", { interests: "cricket" });
    expect(projects.status).toBe(200);
    expect(projects.body.source).toBe("offline");
    expect(projects.body.data.projects.length).toBeGreaterThan(0);

    expect((await call("POST", "/career/resume", { input: { fullName: "Cara" } })).status).toBe(400);
    const resume = await call("POST", "/career/resume", {
      input: { fullName: "Cara", email: "cara@x.io", targetInternship: "Data Science Intern", education: "B.Sc Statistics, 2026" },
    });
    expect(resume.status).toBe(200);
    expect(resume.body.data.resume.certifications).toContain("Python Certified");
    expect((await call("GET", "/career")).body.cache.resume).toBeTruthy();

    // Without an AI key the roadmap insight is simply absent (the plan screen shows nothing extra).
    const insight = await call("POST", "/plan/insight", {});
    expect(insight.body).toEqual({ data: null, source: "offline" });
  });
});
