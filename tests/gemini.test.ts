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
const candidate = (text: string) => ({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP", index: 0 }] });

beforeAll(async () => {
  const mock = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = req.url ?? "";
      calls.push({ url, body: raw ? JSON.parse(raw) : {} });
      if (req.method === "GET" && /\/models\/gemini-2\.5-flash/.test(url)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: { code: 404, message: "models/gemini-2.5-flash is not found", status: "NOT_FOUND" } }));
      }
      if (req.method === "GET" && /\/models\?|\/models$/.test(url)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            models: [
              { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
              { name: "models/gemini-9-flash-lite", supportedGenerationMethods: ["generateContent"] },
              { name: "models/gemini-9-flash", supportedGenerationMethods: ["generateContent"] },
            ],
          }),
        );
      }
      if (url.includes(":streamGenerateContent")) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const t of ["Hi from ", "Gemini!"]) res.write(`data: ${JSON.stringify(candidate(t))}\r\n\r\n`);
        return res.end();
      }
      if (url.includes(":generateContent")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(candidate(JSON.stringify(quiz))));
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
  it("falls back to an available Flash model when the default isn't found", async () => {
    const ai = await import("../server/ai.ts");
    expect(ai.aiProvider).toBe("gemini");
    const r = await ai.checkAi();
    expect(r.ok).toBe(true);
    expect(ai.aiModel()).toBe("gemini-9-flash");
  });

  it("generates a level test as structured JSON", async () => {
    token = (await (await call("POST", "/auth/signup", { name: "Gem", email: "gem@x.io", password: "password1" })).json()).token;
    await call("PUT", "/goal", { roleId: "frontend-dev", levels: { "html-css": 3 }, hoursPerWeek: 10 });
    for (let i = 0; i < 4; i++) await call("POST", "/study", { lessonId: "html-css:3", minutes: 240 });
    const test = await (await call("POST", "/tests/start", { kind: "level", ref: "html-css" })).json();
    expect(test.source).toBe("ai");
    expect(test.questions).toHaveLength(8);
    const req = calls.find((c) => c.url.includes("gemini-9-flash:generateContent"))!;
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
});
