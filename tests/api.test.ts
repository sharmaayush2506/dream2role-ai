import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let base = "";
let close: () => void;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d2r-"));

beforeAll(async () => {
  process.env.DATA_FILE = path.join(dir, "db.json");
  const { createApp } = await import("../server/app.ts");
  const server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  close = () => server.close();
});
afterAll(() => {
  close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function call(method: string, url: string, body?: unknown, token?: string) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

describe("API", () => {
  let ana = "";
  let ben = "";
  let benId = "";
  let anaId = "";

  it("signs up and rejects bad credentials", async () => {
    const a = await call("POST", "/auth/signup", { name: "Ana", email: "ana@x.io", password: "password1" });
    expect(a.status).toBe(201);
    expect(a.body.user.passwordHash).toBeUndefined();
    ana = a.body.token;
    anaId = a.body.user.id;
    expect((await call("POST", "/auth/signup", { name: "Ana", email: "ANA@x.io", password: "password1" })).status).toBe(409);
    expect((await call("POST", "/auth/login", { email: "ana@x.io", password: "nope" })).status).toBe(401);
    expect((await call("GET", "/me")).status).toBe(401);
    const b = await call("POST", "/auth/login", { email: "ana@x.io", password: "password1" });
    expect(b.status).toBe(200);
  });

  it("saves a goal and logs study time", async () => {
    const g = await call("PUT", "/goal", { roleId: "data-scientist", levels: { python: 2 }, hoursPerWeek: 8, deadline: null }, ana);
    expect(g.status).toBe(200);
    expect(g.body.user.goal.levels.python).toBe(2);
    expect((await call("PUT", "/goal", { roleId: "nope", hoursPerWeek: 8 }, ana)).status).toBe(400);
    const s = await call("POST", "/study", { lessonId: "python:2", minutes: 30 }, ana);
    expect(s.status).toBe(200);
    expect(s.body.user.progress.xp).toBe(30);
    expect(s.body.user.progress.streak).toBe(1);
    expect((await call("POST", "/study", { lessonId: "python:2", minutes: 9999 }, ana)).status).toBe(400);
  });

  it("suggests, requests and accepts friends", async () => {
    const b = await call("POST", "/auth/signup", { name: "Ben", email: "ben@x.io", password: "password1" }, undefined);
    ben = b.body.token;
    benId = b.body.user.id;
    await call("PUT", "/goal", { roleId: "data-scientist", hoursPerWeek: 5 }, ben);

    const sug = await call("GET", "/friends/suggestions", undefined, ben);
    expect(sug.body.suggestions[0]).toMatchObject({ id: anaId, reason: "Also wants to be a Data Scientist" });
    expect(sug.body.suggestions[0].email).toBeUndefined();

    await call("POST", "/friends/request", { userId: anaId }, ben);
    const anaView = await call("GET", "/friends", undefined, ana);
    expect(anaView.body.incoming.map((p: { id: string }) => p.id)).toEqual([benId]);
    await call("POST", "/friends/accept", { userId: benId }, ana);

    const benView = await call("GET", "/friends", undefined, ben);
    expect(benView.body.friends).toHaveLength(1);
    expect(benView.body.friends[0].week.minutes).toBe(30);
  });
});
