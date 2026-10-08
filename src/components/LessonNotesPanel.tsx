import { moreNotesUrl, notesFor } from "../../shared/notes.ts";

/** Links to notes on established learning sites (W3Schools, GeeksforGeeks, MDN, ...) for one lesson. */
export default function LessonNotesPanel({
  skillId,
  skillName,
  lessonTitle,
}: {
  skillId: string;
  skillName: string;
  lessonTitle: string;
}) {
  const links = notesFor(skillId, skillName, lessonTitle);
  return (
    <div className="notes-panel">
      <p className="notes-intro">
        Read the notes for <b>{lessonTitle}</b> on these trusted sites. Each link opens that site's page for this topic in a new tab.
      </p>
      <ul className="notes-links">
        {links.map((l, i) => (
          <li key={l.domain}>
            <a className="notes-link card" href={l.url} target="_blank" rel="noreferrer">
              <span className="notes-badge" style={{ background: l.color }} aria-hidden="true">
                {l.name[0]}
              </span>
              <span className="notes-link-body">
                <strong>
                  {l.name}
                  {i === 0 && <em className="notes-pick">Best start</em>}
                </strong>
                <small>{l.blurb}</small>
                <span className="notes-domain">{l.domain}</span>
              </span>
              <span className="notes-open" aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="notes-more">
        Want more?{" "}
        <a href={moreNotesUrl(skillName, lessonTitle)} target="_blank" rel="noreferrer">
          Search all notes on Google ↗
        </a>
      </p>
      <p className="notes-tip">💡 Tip: read one page, then close it and write 3 key points from memory. That's when it sticks.</p>
    </div>
  );
}
