import { describe, expect, it } from "vitest";
import { customRole, ROLES } from "../shared/catalog.ts";
import { moreNotesUrl, notesFor } from "../shared/notes.ts";

describe("lesson notes links", () => {
  it("gives every lesson in every role three notes sites", () => {
    for (const role of [...ROLES, customRole("Game Designer")]) {
      for (const skill of role.skills) {
        for (const topic of skill.topics) {
          const links = notesFor(skill.id, skill.name, topic);
          expect(links).toHaveLength(3);
          for (const l of links) {
            const url = new URL(l.url);
            expect(url.hostname).toBe("duckduckgo.com");
            // "\" jumps straight to the first result, limited to the site.
            expect(url.searchParams.get("q")).toBe(`\\site:${l.domain} ${topic} ${skill.name}`.replace(/&/g, "and"));
          }
        }
      }
    }
  });

  it("uses W3Schools, GeeksforGeeks and MDN for web lessons", () => {
    expect(notesFor("html-css", "HTML & CSS", "Flexbox & Grid").map((l) => l.name)).toEqual(["W3Schools", "GeeksforGeeks", "MDN Web Docs"]);
    expect(notesFor("sql", "SQL", "Joins")[0].name).toBe("W3Schools");
  });

  it("offers a broader Google search", () => {
    expect(moreNotesUrl("SQL", "Joins")).toContain("google.com/search?q=Joins%20SQL%20notes%20tutorial");
  });
});
