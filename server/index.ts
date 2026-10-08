import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.ts";

const app = createApp();
const PORT = Number(process.env.PORT ?? 3001);

// In production, serve the built frontend from the same origin.
if (process.env.NODE_ENV === "production") {
  const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => console.log(`Dream2Role API listening on http://localhost:${PORT}`));
