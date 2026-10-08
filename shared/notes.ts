// Notes for each lesson come from established learning sites (W3Schools, GeeksforGeeks, MDN, ...).
// Each link jumps straight to that site's best-matching page for the lesson, using DuckDuckGo's
// "first result" shortcut limited to the site, so links keep working when sites move pages.

export interface NotesSite {
  name: string;
  domain: string;
  blurb: string;
  color: string; // badge colour
}

const SITES = {
  w3schools: { name: "W3Schools", domain: "w3schools.com", blurb: "Beginner-friendly notes with try-it-yourself examples", color: "#04aa6d" },
  gfg: { name: "GeeksforGeeks", domain: "geeksforgeeks.org", blurb: "Detailed articles with examples and practice problems", color: "#2f8d46" },
  mdn: { name: "MDN Web Docs", domain: "developer.mozilla.org", blurb: "The trusted reference for HTML, CSS and JavaScript", color: "#1b1b1b" },
  react: { name: "React docs", domain: "react.dev", blurb: "Official guides with interactive examples", color: "#087ea4" },
  git: { name: "Pro Git book", domain: "git-scm.com", blurb: "The official Git documentation and free book", color: "#f05032" },
  freecodecamp: { name: "freeCodeCamp", domain: "freecodecamp.org", blurb: "Free in-depth tutorials and handbooks", color: "#0a0a23" },
  python: { name: "Python docs", domain: "docs.python.org", blurb: "The official Python tutorial and reference", color: "#3776ab" },
  pandas: { name: "pandas docs", domain: "pandas.pydata.org", blurb: "Official user guide for data analysis in Python", color: "#150458" },
  sklearn: { name: "scikit-learn", domain: "scikit-learn.org", blurb: "Official machine learning user guide with examples", color: "#f7931e" },
  khan: { name: "Khan Academy", domain: "khanacademy.org", blurb: "Clear lessons on statistics and probability", color: "#14bf96" },
  kaggle: { name: "Kaggle Learn", domain: "kaggle.com", blurb: "Short hands-on data science courses", color: "#20beff" },
  nng: { name: "Nielsen Norman Group", domain: "nngroup.com", blurb: "Research-backed UX articles", color: "#d2232a" },
  idf: { name: "Interaction Design Foundation", domain: "interaction-design.org", blurb: "UX and UI design literature and guides", color: "#1f6feb" },
  figma: { name: "Figma Help", domain: "help.figma.com", blurb: "Official Figma guides", color: "#a259ff" },
  atlassian: { name: "Atlassian guides", domain: "atlassian.com", blurb: "Practical agile and product management guides", color: "#0052cc" },
  productplan: { name: "ProductPlan", domain: "productplan.com", blurb: "Product management glossary and guides", color: "#f15a24" },
  linuxjourney: { name: "Linux Journey", domain: "linuxjourney.com", blurb: "Friendly step-by-step Linux lessons", color: "#333" },
  docker: { name: "Docker docs", domain: "docs.docker.com", blurb: "Official Docker guides", color: "#1d63ed" },
  kubernetes: { name: "Kubernetes docs", domain: "kubernetes.io", blurb: "Official Kubernetes concepts and tutorials", color: "#326ce5" },
  aws: { name: "AWS docs", domain: "docs.aws.amazon.com", blurb: "Official cloud service documentation", color: "#ff9900" },
  hashicorp: { name: "HashiCorp", domain: "developer.hashicorp.com", blurb: "Official Terraform tutorials", color: "#7b42bc" },
  moz: { name: "Moz", domain: "moz.com", blurb: "The classic beginner's guides to SEO", color: "#00a4e4" },
  hubspot: { name: "HubSpot blog", domain: "blog.hubspot.com", blurb: "Marketing guides and templates", color: "#ff7a59" },
  google: { name: "Google Skillshop", domain: "skillshop.withgoogle.com", blurb: "Official Google Ads and Analytics training", color: "#4285f4" },
  wikipedia: { name: "Wikipedia", domain: "en.wikipedia.org", blurb: "A quick overview of the topic", color: "#555" },
} satisfies Record<string, NotesSite>;

type SiteKey = keyof typeof SITES;

/** Best notes sites for each skill (by skill id from the role catalog). */
const BY_SKILL: Record<string, SiteKey[]> = {
  // Frontend developer
  "html-css": ["w3schools", "gfg", "mdn"],
  javascript: ["w3schools", "gfg", "mdn"],
  react: ["react", "w3schools", "gfg"],
  git: ["git", "w3schools", "gfg"],
  "fe-portfolio": ["freecodecamp", "gfg", "mdn"],
  // Data scientist
  python: ["w3schools", "gfg", "python"],
  statistics: ["khan", "gfg", "w3schools"],
  sql: ["w3schools", "gfg", "kaggle"],
  ml: ["gfg", "sklearn", "w3schools"],
  dataviz: ["kaggle", "gfg", "freecodecamp"],
  "ds-portfolio": ["kaggle", "gfg", "freecodecamp"],
  // UX/UI designer
  "design-basics": ["idf", "nng", "gfg"],
  "ux-research": ["nng", "idf", "gfg"],
  figma: ["figma", "idf", "gfg"],
  interaction: ["nng", "idf", "mdn"],
  "ux-portfolio": ["nng", "idf", "freecodecamp"],
  // Product manager
  "pm-foundations": ["atlassian", "productplan", "gfg"],
  "pm-analytics": ["productplan", "atlassian", "w3schools"],
  "pm-research": ["nng", "productplan", "atlassian"],
  "pm-delivery": ["atlassian", "productplan", "gfg"],
  "pm-portfolio": ["productplan", "atlassian", "freecodecamp"],
  // Cloud / DevOps
  linux: ["linuxjourney", "gfg", "freecodecamp"],
  cloud: ["aws", "gfg", "freecodecamp"],
  containers: ["docker", "kubernetes", "gfg"],
  cicd: ["hashicorp", "gfg", "freecodecamp"],
  "devops-portfolio": ["gfg", "freecodecamp", "docker"],
  // Digital marketer
  "mkt-foundations": ["hubspot", "gfg", "wikipedia"],
  seo: ["moz", "hubspot", "google"],
  social: ["hubspot", "gfg", "freecodecamp"],
  ads: ["google", "hubspot", "moz"],
  "mkt-portfolio": ["hubspot", "freecodecamp", "gfg"],
};

const DEFAULT_SITES: SiteKey[] = ["gfg", "freecodecamp", "wikipedia"];

export interface NotesLink extends NotesSite {
  url: string;
}

/** Jumps to the top result for `query` on one site (DuckDuckGo "\" shortcut). */
function firstResultOn(domain: string, query: string): string {
  return `https://duckduckgo.com/?q=${encodeURIComponent(`\\site:${domain} ${query}`)}`;
}

/** Notes links for one lesson, best source first. */
export function notesFor(skillId: string, skillName: string, lessonTitle: string): NotesLink[] {
  const query = `${lessonTitle} ${skillName}`.replace(/&/g, "and");
  return (BY_SKILL[skillId] ?? DEFAULT_SITES).map((key) => {
    const site = SITES[key];
    return { ...site, url: firstResultOn(site.domain, query) };
  });
}

/** A broader search across all sites, as a last resort. */
export function moreNotesUrl(skillName: string, lessonTitle: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${lessonTitle} ${skillName} notes tutorial`)}`;
}
