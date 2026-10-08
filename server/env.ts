// Loads settings from a .env file in the project root (if there is one) before anything else
// reads process.env. .env is git-ignored, so secrets like OPENAI_API_KEY never get committed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
export const envLoaded = fs.existsSync(envFile);
if (envLoaded) process.loadEnvFile(envFile);
