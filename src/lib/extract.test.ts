import { describe, expect, it } from "vitest";
import { paragraphsFromHtml } from "@/lib/extract";

describe("paragraphsFromHtml", () => {
  it("removes a labelled AI summary but keeps the reported text", () => {
    const html = `
      <h3>AT A GLANCE</h3>
      <ul><li>The summary says the trial starts soon.</li></ul>
      <p>This is AI-generated. Read the article for full context. Report any errors.</p>
      <p>MANILA, Philippines - The court wrapped up its hearings on Monday.</p>`;
    expect(paragraphsFromHtml(html)).toEqual(["MANILA, Philippines - The court wrapped up its hearings on Monday."]);
  });

  it("leaves articles without an AI summary alone", () => {
    const html = "<p>The first paragraph of the report.</p><p>The second paragraph of the report.</p>";
    expect(paragraphsFromHtml(html)).toHaveLength(2);
  });

  it("drops bylines and advertisement markers", () => {
    const html = "<p>By GMA News staff</p><p>-- Advertisements --</p><p>The actual reported sentence stays here.</p>";
    expect(paragraphsFromHtml(html)).toEqual(["The actual reported sentence stays here."]);
  });
});

describe("publisher prompts", () => {
  it("drops publish lines and preferred-source prompts", () => {
    const html =
      "<p>Published November 5, 2026 1:06am</p><p>Make this your preferred source to get more updates from this publisher on Google.</p><p>The defense team listed a law professor as its first witness.</p>";
    expect(paragraphsFromHtml(html)).toEqual(["The defense team listed a law professor as its first witness."]);
  });
});
