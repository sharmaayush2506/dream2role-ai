import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emptyProgress, type Progress } from "../shared/game.ts";
import type { Goal } from "../shared/plan.ts";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar: string;
  createdAt: string;
  goal: Goal | null;
  progress: Progress;
  friends: string[];
  incoming: string[]; // friend requests received
  outgoing: string[]; // friend requests sent
}

interface Data {
  users: UserRecord[];
}

const DATA_FILE =
  process.env.DATA_FILE ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "db.json");

let data: Data = load();

function load(): Data {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Data;
  } catch {
    return { users: [] };
  }
}

/** Write atomically so a crash mid-write can't corrupt the file. */
export function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

export const db = {
  users: () => data.users,
  byId: (id: string) => data.users.find((u) => u.id === id),
  byEmail: (email: string) => data.users.find((u) => u.email === email.toLowerCase()),
  insert(user: Omit<UserRecord, "progress" | "friends" | "incoming" | "outgoing" | "goal">) {
    const rec: UserRecord = { ...user, goal: null, progress: emptyProgress(), friends: [], incoming: [], outgoing: [] };
    data.users.push(rec);
    save();
    return rec;
  },
  reset(next: Data) {
    data = next;
    save();
  },
};
