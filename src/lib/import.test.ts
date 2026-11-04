import { describe, expect, it } from "vitest";
import { bookmarkletCode, isWebUrl, parseImportHash, titlesMatch } from "@/lib/import";

const hashOf = (data: unknown) => `#${encodeURIComponent(JSON.stringify(data))}`;

describe("parseImportHash", () => {
  it("reads a valid article", () => {
    const parsed = parseImportHash(hashOf({ u: "https://news.abs-cbn.com/a", t: " Title ", p: ["One", 2, "Two"] }));
    expect(parsed).toEqual({ url: "https://news.abs-cbn.com/a", title: "Title", paragraphs: ["One", "Two"] });
  });

  it.each([
    ["a script link", hashOf({ u: "javascript:alert(1)", t: "x", p: [] })],
    ["a missing title", hashOf({ u: "https://a.example", p: [] })],
    ["text that is not JSON", "#hello"],
    ["nothing", ""],
    ["a broken encoding", "#%E0%A4%A"],
  ])("rejects %s", (_, hash) => {
    expect(parseImportHash(hash)).toBeNull();
  });
});

describe("isWebUrl", () => {
  it("allows only web links", () => {
    expect(isWebUrl("https://a.example/x")).toBe(true);
    expect(isWebUrl("http://a.example/x")).toBe(true);
    expect(isWebUrl("javascript:alert(1)")).toBe(false);
    expect(isWebUrl("data:text/html,hi")).toBe(false);
    expect(isWebUrl("not a link")).toBe(false);
  });
});

describe("titlesMatch", () => {
  const listed = "TV PATROL: Alex Eala nasungkit ang bagong career-high na world number 17";

  it("ignores case and punctuation", () => {
    expect(titlesMatch(listed, "TV Patrol - Alex Eala nasungkit ang bagong career high na world number 17")).toBe(true);
  });

  it("accepts a title with the site's name added", () => {
    expect(titlesMatch(listed, `${listed} | ABS-CBN News`)).toBe(true);
  });

  it("rejects different stories", () => {
    expect(titlesMatch(listed, "TV PATROL: Pag-ulan inaasahan sa ilang lugar sa bansa")).toBe(false);
  });

  it("does not match on a very short title", () => {
    expect(titlesMatch("News", "News from the provinces today")).toBe(false);
  });
});

describe("bookmarkletCode", () => {
  it("is a single line that targets this app", () => {
    const code = bookmarkletCode("http://localhost:3000");
    expect(code.startsWith("javascript:")).toBe(true);
    expect(code).not.toContain("\n");
    expect(code).toContain('"http://localhost:3000/import#"');
  });
});
