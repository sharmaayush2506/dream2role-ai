import { envFile, envLoaded } from "./env.ts"; // must come first: loads .env before other modules read settings
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.ts";
import { aiEnabled, aiModel, aiProvider, checkAi } from "./ai.ts";

const app = createApp();
const PORT = Number(process.env.PORT ?? 3001);

// In production, serve the built frontend from the same origin.
if (process.env.NODE_ENV === "production") {
  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Dream2Role API listening on http://localhost:${PORT}`);
  console.log(envLoaded ? `Settings loaded from ${envFile}` : `No .env file found at ${envFile}`);
  if (!aiEnabled) {
    console.log("AI: OFF. Add GEMINI_API_KEY=... (or OPENAI_API_KEY=...) to the .env file above, then restart with npm run dev.");
    return;
  }
  const name = aiProvider === "gemini" ? "Gemini" : "OpenAI";
  console.log(`AI: ${name} key found, checking model ${aiModel()}...`);
  checkAi().then((r) => {
    if (!r.ok) return console.log(`AI: NOT WORKING ❌ ${r.reason}`);
    if (r.note) console.log(`AI: ${r.note}`);
    console.log(`AI: ON ✅ ${name} (${aiModel()}) is working.`);
  });
});
