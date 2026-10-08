import { roleForGoal, type Goal } from "./plan.ts";

/** Prices in Indian rupees. */
export const PRICING = {
  currency: "INR",
  symbol: "₹",
  single: { credits: 1, amount: 299, label: "1 certificate" },
  bundle: { credits: 3, amount: 699, label: "3 certificates" },
} as const;
export type Pack = "single" | "bundle";

export const LEVEL_TEST = { questions: 8, passPercent: 70 };
export const CERT_TEST = { questions: 15, passPercent: 75 };

export interface CertDef {
  id: string;
  title: string;
  icon: string;
  /** Level tests (skill ids) that must be passed before the certificate can be unlocked. */
  requires: string[];
  /** The level number (1-based) at which it unlocks, for display. */
  level: number;
  skills: string[]; // skill names the exam covers
}

/** One certificate per level, plus a capstone for the whole role once every level is passed. */
export function certsForGoal(goal: Pick<Goal, "roleId" | "roleTitle">): CertDef[] {
  const role = roleForGoal(goal);
  const perSkill = role.skills.map((s, i) => ({
    id: `${role.id}:${s.id}`,
    title: `${s.name} Certified`,
    icon: s.icon,
    requires: [s.id],
    level: i + 1,
    skills: [s.name],
  }));
  return [
    ...perSkill,
    {
      id: `${role.id}:capstone`,
      title: `Job-Ready ${role.title}`,
      icon: "🎓",
      requires: role.skills.map((s) => s.id),
      level: role.skills.length,
      skills: role.skills.map((s) => s.name),
    },
  ];
}

export function certEligible(cert: CertDef, passedTests: Record<string, unknown>): boolean {
  return cert.requires.every((id) => passedTests[id]);
}

/** How many of the role's level tests the learner has passed. Career tools are open to everyone. */
export function careerReadiness(goal: Pick<Goal, "roleId" | "roleTitle">, passedTests: Record<string, unknown>) {
  const skills = roleForGoal(goal).skills;
  const passed = skills.filter((s) => passedTests[s.id]).length;
  return { passed, total: skills.length };
}
