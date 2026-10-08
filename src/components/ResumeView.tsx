import type { ReactNode } from "react";
import type { Resume, ResumeInput, ResumeSection } from "../lib/api.ts";

const TITLES: Record<ResumeSection, string> = {
  skills: "Skills",
  projects: "Projects",
  experience: "Experience",
  education: "Education",
  certifications: "Certifications",
};

/** A clean, printable one-page resume. */
export default function ResumeView({ resume, contact }: { resume: Resume; contact: ResumeInput }) {
  const order = [...new Set<ResumeSection>([...resume.sectionOrder, "skills", "projects", "experience", "education", "certifications"])];
  const contactLine = [contact.email, contact.phone, contact.location, contact.links].filter(Boolean).join("  ·  ");

  const body: Record<ResumeSection, ReactNode> = {
    skills: resume.skills.length ? (
      <div className="r-skills">
        {resume.skills.map((s) => (
          <p key={s.category}><b>{s.category}:</b> {s.items.join(", ")}</p>
        ))}
      </div>
    ) : null,
    projects: resume.projects.length ? (
      <>
        {resume.projects.map((p) => (
          <div key={p.name} className="r-item">
            <div className="r-item-head"><b>{p.name}</b>{p.stack && <i>{p.stack}</i>}</div>
            <ul>{p.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
          </div>
        ))}
      </>
    ) : null,
    experience: resume.experience.length ? (
      <>
        {resume.experience.map((e, i) => (
          <div key={i} className="r-item">
            <div className="r-item-head"><b>{e.title}{e.organization && `, ${e.organization}`}</b><span>{e.dates}</span></div>
            {e.bullets.length > 0 && <ul>{e.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
          </div>
        ))}
      </>
    ) : null,
    education: resume.education.length ? (
      <>
        {resume.education.map((e, i) => (
          <div key={i} className="r-item">
            <div className="r-item-head"><b>{e.degree}{e.school && `, ${e.school}`}</b><span>{e.dates}</span></div>
            {e.details && <p>{e.details}</p>}
          </div>
        ))}
      </>
    ) : null,
    certifications: resume.certifications.length ? <ul>{resume.certifications.map((c) => <li key={c}>{c}</li>)}</ul> : null,
  };

  return (
    <div className="resume-paper" id="resume-print">
      <header>
        <h1>{contact.fullName}</h1>
        <p className="r-headline">{resume.headline}</p>
        <p className="r-contact">{contactLine}</p>
      </header>
      {resume.summary && <p className="r-summary">{resume.summary}</p>}
      {order.map((k) =>
        body[k] ? (
          <section key={k}>
            <h2>{TITLES[k]}</h2>
            {body[k]}
          </section>
        ) : null,
      )}
    </div>
  );
}
