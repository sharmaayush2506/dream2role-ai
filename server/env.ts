// Loads settings from a .env file in the project root (if there is one) before anything else
// reads process.env. .env is git-ignored, so secrets like OPENAI_API_KEY never get committed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
