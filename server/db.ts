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
  certCredits: number; // paid certificate exams not yet assigned to a certificate
  unlockedCerts: string[]; // certificates whose exam the user has paid for
  certificates: CertificateRecord[];
  payments: PaymentRecord[];
  tests: Record<string, PendingTest>; // tests in progress, keyed by test id
  careerCache: Partial<Record<"internships" | "projects" | "resume", { data: unknown; source: "ai" | "offline"; aiError?: string; at: string }>>;
  notesCache: Record<string, { data: unknown; source: "ai" | "offline"; aiError?: string; at: string }>; // key: lesson|depth|focus
}

export interface Question {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface PendingTest {
  id: string;
  kind: "level" | "cert";
  ref: string; // skill id for level tests, certificate id for certification exams
  title: string;
  questions: Question[];
  answers: (number | null)[];
  source: "ai" | "offline";
  createdAt: string;
}

export interface CertificateRecord {
  id: string; // public verification id
  certId: string;
  title: string;
  roleTitle: string;
  score: number;
  total: number;
  issuedAt: string;
}

export interface PaymentRecord {
  orderId: string;
  provider: "razorpay" | "demo";
  pack: "single" | "bundle";
  amount: number; // rupees
  credits: number;
  status: "created" | "paid";
  paymentId?: string;
  createdAt: string;
}

const DEFAULTS = { certCredits: 0, unlockedCerts: [], certificates: [], payments: [], tests: {}, careerCache: {}, notesCache: {} };

interface Data {
  users: UserRecord[];
}

const DATA_FILE =
  process.env.DATA_FILE ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "db.json");

let data: Data = load();

function load(): Data {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as Data;
    // Fill in fields added after a user was created.
    d.users = d.users.map((u) => ({ ...structuredClone(DEFAULTS), ...u, progress: { ...emptyProgress(), ...u.progress } }));
    return d;
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
  certificate: (id: string) => {
    for (const u of data.users) {
      const c = u.certificates.find((c) => c.id === id);
      if (c) return { user: u, cert: c };
    }
    return null;
  },
  insert(user: Pick<UserRecord, "id" | "name" | "email" | "passwordHash" | "avatar" | "createdAt">) {
    const rec: UserRecord = {
      ...user,
      ...structuredClone(DEFAULTS),
      goal: null,
      progress: emptyProgress(),
      friends: [],
      incoming: [],
      outgoing: [],
    };
    data.users.push(rec);
    save();
    return rec;
  },
  reset(next: Data) {
    data = next;
    save();
  },
};
