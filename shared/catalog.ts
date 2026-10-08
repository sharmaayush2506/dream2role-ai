// Role catalog: every dream job is broken into skills ("units" on the path),
// and every skill into topics ("lessons"). `hours` is the rough effort needed
// to go from zero to job-ready in that skill.

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  hours: number;
  topics: string[];
}

export interface RoleDef {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  skills: SkillDef[];
}

export const ROLES: RoleDef[] = [
  {
    id: "frontend-dev",
    title: "Frontend Developer",
    emoji: "🧑‍💻",
    blurb: "Build the websites and apps people click every day.",
    skills: [
      { id: "html-css", name: "HTML & CSS", icon: "🎨", hours: 60, topics: ["Semantic HTML", "Box model & layout", "Flexbox & Grid", "Responsive design"] },
      { id: "javascript", name: "JavaScript", icon: "⚡", hours: 120, topics: ["Syntax & types", "Functions & scope", "DOM & events", "Async & fetch", "Modules & tooling"] },
      { id: "react", name: "React", icon: "⚛️", hours: 80, topics: ["Components & props", "State & hooks", "Routing", "Data fetching"] },
      { id: "git", name: "Git & Collaboration", icon: "🌿", hours: 20, topics: ["Commits & branches", "Pull requests"] },
      { id: "fe-portfolio", name: "Portfolio & Interviews", icon: "🏆", hours: 50, topics: ["Capstone project", "Portfolio site", "Interview practice"] },
    ],
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    emoji: "📊",
    blurb: "Turn messy data into decisions and predictions.",
    skills: [
      { id: "python", name: "Python", icon: "🐍", hours: 80, topics: ["Basics & data types", "Functions & OOP", "NumPy", "Pandas"] },
      { id: "statistics", name: "Statistics", icon: "📐", hours: 70, topics: ["Descriptive stats", "Probability", "Hypothesis testing", "Regression"] },
      { id: "sql", name: "SQL", icon: "🗄️", hours: 40, topics: ["SELECT & filtering", "Joins", "Aggregations & windows"] },
      { id: "ml", name: "Machine Learning", icon: "🤖", hours: 120, topics: ["Supervised learning", "Model evaluation", "Feature engineering", "Unsupervised learning", "scikit-learn projects"] },
      { id: "dataviz", name: "Data Storytelling", icon: "📈", hours: 30, topics: ["Charts that work", "Dashboards", "Presenting insights"] },
      { id: "ds-portfolio", name: "Portfolio & Interviews", icon: "🏆", hours: 50, topics: ["Kaggle project", "Case studies", "Interview practice"] },
    ],
  },
  {
    id: "ux-designer",
    title: "UX/UI Designer",
    emoji: "🎨",
    blurb: "Design products that feel effortless to use.",
    skills: [
      { id: "design-basics", name: "Visual Design", icon: "🖌️", hours: 50, topics: ["Typography", "Color & contrast", "Layout & spacing"] },
      { id: "ux-research", name: "User Research", icon: "🔍", hours: 50, topics: ["Interviews", "Personas & journeys", "Usability testing"] },
      { id: "figma", name: "Figma", icon: "🧩", hours: 40, topics: ["Frames & components", "Auto layout", "Prototyping"] },
      { id: "interaction", name: "Interaction Design", icon: "👆", hours: 40, topics: ["Information architecture", "Wireframing", "Accessibility"] },
      { id: "ux-portfolio", name: "Portfolio & Interviews", icon: "🏆", hours: 60, topics: ["Case study #1", "Case study #2", "Portfolio review"] },
    ],
  },
  {
    id: "product-manager",
    title: "Product Manager",
    emoji: "🚀",
    blurb: "Decide what to build next, and why.",
    skills: [
      { id: "pm-foundations", name: "Product Thinking", icon: "💡", hours: 40, topics: ["Problem framing", "Prioritization", "Roadmaps"] },
      { id: "pm-analytics", name: "Product Analytics", icon: "📊", hours: 40, topics: ["Metrics & KPIs", "A/B testing", "SQL for PMs"] },
      { id: "pm-research", name: "Customer Discovery", icon: "🗣️", hours: 30, topics: ["User interviews", "Jobs to be done"] },
      { id: "pm-delivery", name: "Agile Delivery", icon: "🏃", hours: 30, topics: ["Writing specs", "Scrum & Kanban", "Working with engineers"] },
      { id: "pm-portfolio", name: "Portfolio & Interviews", icon: "🏆", hours: 40, topics: ["Product case study", "Interview practice"] },
    ],
  },
  {
    id: "cloud-engineer",
    title: "Cloud / DevOps Engineer",
    emoji: "☁️",
    blurb: "Keep apps fast, reliable and shipping daily.",
    skills: [
      { id: "linux", name: "Linux & Shell", icon: "🐧", hours: 40, topics: ["Filesystem & permissions", "Shell scripting", "Processes & networking"] },
      { id: "cloud", name: "Cloud Fundamentals", icon: "☁️", hours: 80, topics: ["Compute", "Storage & databases", "Networking & IAM", "Certification prep"] },
      { id: "containers", name: "Docker & Kubernetes", icon: "🐳", hours: 70, topics: ["Docker images", "Compose", "Kubernetes basics", "Helm & deployments"] },
      { id: "cicd", name: "CI/CD & IaC", icon: "🔁", hours: 50, topics: ["Pipelines", "Terraform", "Monitoring & alerts"] },
      { id: "devops-portfolio", name: "Portfolio & Interviews", icon: "🏆", hours: 40, topics: ["Homelab project", "Interview practice"] },
    ],
  },
  {
    id: "digital-marketer",
    title: "Digital Marketer",
    emoji: "📣",
    blurb: "Grow audiences and turn them into customers.",
    skills: [
      { id: "mkt-foundations", name: "Marketing Basics", icon: "🎯", hours: 30, topics: ["Positioning", "Funnels", "Customer personas"] },
      { id: "seo", name: "SEO & Content", icon: "🔎", hours: 50, topics: ["Keyword research", "On-page SEO", "Content strategy"] },
      { id: "social", name: "Social Media", icon: "📱", hours: 40, topics: ["Platform playbooks", "Community", "Short-form video"] },
      { id: "ads", name: "Paid Ads & Analytics", icon: "💸", hours: 50, topics: ["Search ads", "Social ads", "Analytics & attribution"] },
      { id: "mkt-portfolio", name: "Portfolio & Interviews", icon: "🏆", hours: 30, topics: ["Campaign case study", "Interview practice"] },
    ],
  },
];

/** Generic path used when the dream job isn't in the catalog. */
export function customRole(title: string): RoleDef {
  return {
    id: "custom",
    title,
    emoji: "🌟",
    blurb: "Your own path. We'll keep you on track.",
    skills: [
      { id: "c-foundations", name: "Foundations", icon: "📚", hours: 50, topics: ["Core concepts", "Key vocabulary", "Industry overview"] },
      { id: "c-tools", name: "Core Tools", icon: "🛠️", hours: 60, topics: ["Tool #1", "Tool #2", "Everyday workflows"] },
      { id: "c-practice", name: "Hands-on Practice", icon: "🧪", hours: 70, topics: ["Guided project", "Solo project", "Feedback & iteration"] },
      { id: "c-network", name: "Network & Mentors", icon: "🤝", hours: 20, topics: ["Find a mentor", "Join communities"] },
      { id: "c-portfolio", name: "Portfolio & Interviews", icon: "🏆", hours: 40, topics: ["Portfolio", "Interview practice"] },
    ],
  };
}

export function findRole(roleId: string, customTitle?: string): RoleDef {
  return ROLES.find((r) => r.id === roleId) ?? customRole(customTitle?.trim() || "My Dream Job");
}
