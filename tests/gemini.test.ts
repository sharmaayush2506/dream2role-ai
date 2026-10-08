// Runs the AI features against a local mock of the Gemini REST API, so the real
// request/response handling (JSON output, streaming, model check) is exercised without a key.
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let base = "";
const calls: { url: string; body: Record<string, unknown> }[] = [];
const servers: http.Server[] = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d2r-gemini-"));

const quiz = {
  questions: Array.from({ length: 10 }, (_, i) => ({
    question: `Q${i + 1}?`,
    options: ["A", "B", "C", "D"],
    answerIndex: i % 4,
    explanation: "Because.",
  })),
};
const resume = {
  headline: "Frontend Developer Intern candidate",
  summary: "Builds accessible React apps.",
  sectionOrder: ["skills", "projects", "education", "experience", "certifications"],
  skills: [{ category: "Frontend", items: ["HTML & CSS", "React"] }],
  projects: [{ name: "Weather app", stack: "React, Vite", bullets: ["Shows 7-day forecasts from a public API"] }],
  experience: [],
  education: [{ degree: "B.Tech Computer Science", school: "Delhi University", dates: "2023–2027", details: "CGPA 8.4" }],
  certifications: [],
  tips: ["Add a link to the live weather app."],
};
let failResume = false;
const candidate = (text: string) => ({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP", index: 0 }] });

beforeAll(async () => {
  // Simulates retired models: Google still lists them, but generating with them returns 404.
  const RETIRED = ["gemini-flash-latest", "gemini-9-flash"];
  const notFound = (res: http.ServerResponse, m: string) => {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { code: 404, message: `models/${m} is no longer available to new users`, status: "NOT_FOUND" } }));
  };
  const mock = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = req.url ?? "";
      calls.push({ url, body: raw ? JSON.parse(raw) : {} });
      const m = url.match(/models\/([\w.-]+):/)?.[1] ?? "";
      if (req.method === "GET" && /\/models(\?|$)/.test(url)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            models: [
              { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
              { name: "models/gemini-9-flash-lite", supportedGenerationMethods: ["generateContent"] },
              { name: "models/gemini-10-flash-preview", supportedGenerationMethods: ["generateContent"] },
              { name: "models/gemini-8-flash", supportedGenerationMethods: ["generateContent"] },
              { name: "models/gemini-9-flash", supportedGenerationMethods: ["generateContent"] },
            ],
          }),
        );
      }
      if (url.includes(":streamGenerateContent")) {
        if (RETIRED.includes(m)) return notFound(res, m);
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const t of ["Hi from ", "Gemini!"]) res.write(`data: ${JSON.stringify(candidate(t))}\r\n\r\n`);
        return res.end();
      }
      if (url.includes(":generateContent")) {
        if (RETIRED.includes(m)) return notFound(res, m);
        const body = JSON.parse(raw);
        const wantsJson = body.generationConfig?.responseMimeType === "application/json";
        res.writeHead(200, { "Content-Type": "application/json" });
        const props = Object.keys(body.generationConfig?.responseJsonSchema?.properties ?? {});
        if (props.includes("headline")) {
          if (failResume) return res.end(JSON.stringify(candidate("not json")));
          return res.end(JSON.stringify(candidate(JSON.stringify(resume))));
        }
        return res.end(JSON.stringify(candidate(wantsJson ? JSON.stringify(quiz) : "OK")));
      }
      res.writeHead(404);
      res.end("{}");
    });
  });
  await new Promise<void>((r) => mock.listen(0, r));
  servers.push(mock);

  process.env.DATA_FILE = path.join(dir, "db.json");
  delete process.env.OPENAI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
  const { createApp } = await import("../server/app.ts");
  const app = createApp().listen(0);
  servers.push(app);
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}/api`;
});
afterAll(() => {
  servers.forEach((s) => s.close());
  fs.rmSync(dir, { recursive: true, force: true });
});

let token = "";
const call = (method: string, url: string, body?: unknown) =>
  fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("Gemini integration", () => {
  it("skips retired models and switches to the newest working stable Flash model", async () => {
    const ai = await import("../server/ai.ts");
    expect(ai.aiProvider).toBe("gemini");
    expect(ai.aiModel()).toBe("gemini-flash-latest");
    const r = await ai.checkAi();
    expect(r).toMatchObject({ ok: true });
    // gemini-9-flash is newest but retired; previews and Lite rank lower than stable Flash.
    expect(ai.aiModel()).toBe("gemini-8-flash");
  });

  it("generates a level test as structured JSON", async () => {
    token = (await (await call("POST", "/auth/signup", { name: "Gem", email: "gem@x.io", password: "password1" })).json()).token;
    await call("PUT", "/goal", { roleId: "frontend-dev", levels: { "html-css": 3 }, hoursPerWeek: 10 });
    for (let i = 0; i < 4; i++) await call("POST", "/study", { lessonId: "html-css:3", minutes: 240 });
    const test = await (await call("POST", "/tests/start", { kind: "level", ref: "html-css" })).json();
    expect(test.source).toBe("ai");
    expect(test.questions).toHaveLength(8);
    const req = calls.find((c) => c.url.includes("gemini-8-flash:generateContent") && (c.body.generationConfig as { responseMimeType?: string })?.responseMimeType === "application/json")!;
    const cfg = req.body.generationConfig as { responseMimeType: string; responseJsonSchema: { type: string } };
    expect(cfg.responseMimeType).toBe("application/json");
    expect(cfg.responseJsonSchema.type).toBe("object");
  });

  it("streams Rolo's reply", async () => {
    const res = await call("POST", "/coach", { messages: [{ role: "user", content: "What next?" }] });
    expect(await res.text()).toBe("Hi from Gemini!");
    const req = calls.find((c) => c.url.includes(":streamGenerateContent"))!;
    expect(JSON.stringify(req.body.systemInstruction)).toContain("Dream job: Frontend Developer");
  });

  it("writes the resume with AI", async () => {
    const input = { fullName: "Gem", email: "gem@x.io", targetInternship: "Frontend Developer Intern", education: "B.Tech CS, 2027" };
    const r = await (await call("POST", "/career/resume", { input })).json();
    expect(r.source).toBe("ai");
    expect(r.data.resume.headline).toBe("Frontend Developer Intern candidate");
    const req = calls.filter((c) => JSON.stringify(c.body).includes('"headline"')).pop()!;
    const schema = JSON.stringify((req.body.generationConfig as { responseJsonSchema: unknown }).responseJsonSchema);
    expect(schema).not.toContain("$schema");
    expect(schema).not.toContain("additionalProperties");
  });

  it("explains why when AI can't write the resume", async () => {
    failResume = true;
    const input = { fullName: "Gem", email: "gem@x.io", targetInternship: "Frontend Developer Intern", education: "B.Tech CS, 2027" };
    const r = await (await call("POST", "/career/resume", { input })).json();
    failResume = false;
    expect(r.source).toBe("offline");
    expect(r.aiError).toBeTruthy();
    expect(r.data.resume.tips).toEqual([]);
  });
});
