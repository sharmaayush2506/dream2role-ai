// Runs the AI features against a local mock of the OpenAI Responses API, so the real
// request/response handling (structured outputs and streaming) is exercised without a key.
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let base = "";
const requests: Record<string, unknown>[] = [];
const servers: http.Server[] = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d2r-openai-"));

const quiz = {
  questions: Array.from({ length: 10 }, (_, i) => ({
    question: `Question ${i + 1}?`,
    options: ["A", "B", "C", "D"],
    answerIndex: i % 4,
    explanation: "Because.",
  })),
};

function responseBody(text: string) {
  return {
    id: "resp_1",
    object: "response",
    created_at: 0,
    status: "completed",
    model: "mock",
    output: [{ type: "message", id: "msg_1", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] }],
    parallel_tool_calls: false,
    tool_choice: "auto",
    tools: [],
  };
}

beforeAll(async () => {
  const mock = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = JSON.parse(body);
      requests.push(json);
      if (json.stream) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const delta of ["Hi! ", "Study ", "**Flexbox** today."]) {
          res.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta, item_id: "msg_1", output_index: 0, content_index: 0, sequence_number: 1, logprobs: [] })}\n\n`);
        }
        res.end(`event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: responseBody("Hi! Study **Flexbox** today."), sequence_number: 2 })}\n\n`);
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(responseBody(JSON.stringify(quiz))));
    });
  });
  await new Promise<void>((r) => mock.listen(0, r));
  servers.push(mock);

  process.env.DATA_FILE = path.join(dir, "db.json");
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(mock.address() as AddressInfo).port}/v1`;
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
async function call(method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

describe("OpenAI integration", () => {
  it("generates a level test with structured outputs", async () => {
    const s = await (await call("POST", "/auth/signup", { name: "Dev", email: "dev@x.io", password: "password1" })).json();
    token = s.token;
    await call("PUT", "/goal", { roleId: "frontend-dev", levels: { "html-css": 3 }, hoursPerWeek: 10 });
    for (let i = 0; i < 4; i++) await call("POST", "/study", { lessonId: "html-css:3", minutes: 240 });

    const test = await (await call("POST", "/tests/start", { kind: "level", ref: "html-css" })).json();
    expect(test.source).toBe("ai");
    expect(test.questions).toHaveLength(8);
    const req = requests[0] as { model: string; text: { format: { type: string } } };
    expect(req.model).toBe("gpt-5.4-mini");
    expect(req.text.format.type).toBe("json_schema");
  });

  it("streams the AI coach's reply with the learner's context", async () => {
    const res = await call("POST", "/coach", { messages: [{ role: "user", content: "What should I study today?" }] });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hi! Study **Flexbox** today.");
    const req = requests[requests.length - 1] as { instructions: string; stream: boolean };
    expect(req.stream).toBe(true);
    expect(req.instructions).toContain("Dream job: Frontend Developer");
    expect(req.instructions).toContain("Next step in the app: the HTML & CSS level test");
  });

  it("rejects malformed chat history", async () => {
    expect((await call("POST", "/coach", { messages: [{ role: "system", content: "hi" }] })).status).toBe(400);
    expect((await call("POST", "/coach", { messages: "hi" })).status).toBe(400);
  });
});
