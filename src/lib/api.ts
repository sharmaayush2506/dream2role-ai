import type { Goal } from "../../shared/plan.ts";
import type { GameEvent, Progress, WeekSummary } from "../../shared/game.ts";
import { localDay } from "../../shared/game.ts";

export interface Me {
  id: string;
  name: string;
  email: string;
  avatar: string;
  goal: Goal | null;
  progress: Progress;
  incomingCount: number;
  certCredits: number;
  unlockedCerts: string[];
  certificates: Certificate[];
  features: { ai: boolean; payments: "razorpay" | "demo" | "off" };
}

export interface Certificate {
  id: string;
  certId: string;
  title: string;
  roleTitle: string;
  score: number;
  total: number;
  issuedAt: string;
}

export interface TestSession {
  testId: string;
  kind: "level" | "cert";
  title: string;
  source: "ai" | "offline";
  passPercent: number;
  questions: { question: string; options: string[] }[];
  answers: (number | null)[];
}

export interface TestResult {
  score: number;
  total: number;
  passed: boolean;
  passPercent: number;
  events: GameEvent[];
  certificate: Certificate | null;
  user: Me;
}

export interface AiResult<T> {
  data: T;
  source: "ai" | "offline";
  at?: string;
}

export interface Internship {
  title: string;
  companyTypes: string[];
  whyYouFit: string;
  skillsToHighlight: string[];
  gapsToClose: string[];
  searchKeywords: string;
}

export interface Project {
  name: string;
  pitch: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedHours: number;
  techStack: { name: string; purpose: string }[];
  features: string[];
  milestones: { title: string; tasks: string[] }[];
  aiHelpIdeas: string[];
  portfolioTip: string;
}

export interface ResumeInput {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  links: string;
  targetInternship: string;
  education: string;
  experience: string;
  projects: string;
  extra: string;
}

export type ResumeSection = "skills" | "projects" | "experience" | "education" | "certifications";

export interface Resume {
  headline: string;
  summary: string;
  sectionOrder: ResumeSection[];
  skills: { category: string; items: string[] }[];
  projects: { name: string; stack: string; bullets: string[] }[];
  experience: { title: string; organization: string; dates: string; bullets: string[] }[];
  education: { degree: string; school: string; dates: string; details: string }[];
  certifications: string[];
  tips: string[];
}

export interface Readiness {
  passed: number;
  total: number;
  projectsUnlocked: boolean;
  internshipsUnlocked: boolean;
  internshipsAt: number;
}

export interface Order {
  provider: "razorpay" | "demo";
  keyId: string | null;
  orderId: string;
  amount: number;
  currency: string;
  credits: number;
}

export interface PublicCard {
  id: string;
  name: string;
  avatar: string;
  roleTitle: string | null;
  roleEmoji: string | null;
  reason?: string;
  status?: "friend" | "requested" | "incoming" | "none";
}

export interface FriendCard extends PublicCard {
  level: number;
  levelTitle: string;
  xp: number;
  streak: number;
  week: WeekSummary;
  weeklyGoalMinutes: number | null;
  percentDone: number;
}

const TOKEN_KEY = "d2r.token";

export const token = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`/api${path}${sep}today=${localDay()}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token.get() ? { Authorization: `Bearer ${token.get()}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify({ ...(body as object), today: localDay() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong");
  return data as T;
}

export const api = {
  signup: (name: string, email: string, password: string) =>
    request<{ token: string; user: Me }>("POST", "/auth/signup", { name, email, password }),
  login: (email: string, password: string) => request<{ token: string; user: Me }>("POST", "/auth/login", { email, password }),
  me: () => request<{ user: Me }>("GET", "/me"),
  saveGoal: (goal: Omit<Goal, "createdAt">) => request<{ user: Me }>("PUT", "/goal", goal),
  study: (lessonId: string, minutes: number) =>
    request<{ user: Me; events: GameEvent[] }>("POST", "/study", { lessonId, minutes }),
  friends: () =>
    request<{ me: FriendCard; friends: FriendCard[]; incoming: PublicCard[]; outgoing: PublicCard[] }>("GET", "/friends"),
  suggestions: () => request<{ suggestions: PublicCard[] }>("GET", "/friends/suggestions"),
  search: (q: string) => request<{ results: PublicCard[] }>("GET", `/users/search?q=${encodeURIComponent(q)}`),
  addFriend: (userId: string) => request("POST", "/friends/request", { userId }),
  accept: (userId: string) => request("POST", "/friends/accept", { userId }),
  decline: (userId: string) => request("POST", "/friends/decline", { userId }),
  unfriend: (userId: string) => request("DELETE", `/friends/${userId}`),

  startTest: (kind: "level" | "cert", ref: string) => request<TestSession>("POST", "/tests/start", { kind, ref }),
  answer: (testId: string, index: number, choice: number) =>
    request<{ correct: boolean; answerIndex: number; explanation: string }>("POST", `/tests/${testId}/answer`, { index, choice }),
  finishTest: (testId: string) => request<TestResult>("POST", `/tests/${testId}/finish`, {}),

  unlockCert: (certId: string) => request<{ user: Me }>("POST", `/certs/${encodeURIComponent(certId)}/unlock`, {}),
  certificate: (id: string) => request<Certificate & { name: string }>("GET", `/certificates/${encodeURIComponent(id)}`),
  createOrder: (pack: "single" | "bundle") => request<Order>("POST", "/payments/order", { pack }),
  verifyPayment: (orderId: string, paymentId: string, signature: string) =>
    request<{ credits: number; user: Me }>("POST", "/payments/verify", { orderId, paymentId, signature }),

  career: () =>
    request<{
      readiness: Readiness;
      cache: {
        internships?: AiResult<{ internships: Internship[]; tips: string[] }>;
        projects?: AiResult<{ projects: Project[] }>;
        resume?: AiResult<{ resume: Resume; input: ResumeInput }>;
      };
    }>("GET", "/career"),
  internships: () => request<AiResult<{ internships: Internship[]; tips: string[] }>>("POST", "/career/internships", {}),
  projects: (interests: string) => request<AiResult<{ projects: Project[] }>>("POST", "/career/projects", { interests }),
  resume: (input: ResumeInput) => request<AiResult<{ resume: Resume; input: ResumeInput }>>("POST", "/career/resume", { input }),
};
