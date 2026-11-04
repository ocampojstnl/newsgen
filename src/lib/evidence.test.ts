import { describe, expect, it } from "vitest";
import { articleAsText, citedSources, readableUrl, shortCredit, sourcesHeading } from "@/lib/evidence";
import type { Sentence, VersionContent } from "@/lib/types";

const sentence = (id: string, text: string, sources: string[]): Sentence => ({
  id,
  text,
  factIds: [],
  evidence: sources.map((source) => ({ source, paragraph: 1, quote: "a quoted passage" })),
});

const content: VersionContent = {
  headline: sentence("headline", "The headline", ["S1"]),
  dek: null,
  paragraphs: [[sentence("s1", "First sentence.", ["S1"]), sentence("s2", "Second sentence.", ["S3"])]],
  credit: "Source credit: This report is based on reports from GMA News and Rappler.",
};

const sources = [
  { label: "S1", outlet_name: "GMA News", title: "First title", url: "https://gma.example/one" },
  { label: "S2", outlet_name: "Unused", title: "Not cited", url: "https://unused.example/" },
  { label: "S3", outlet_name: "Rappler", title: "Third title", url: "https://rappler.example/three" },
];

describe("citedSources", () => {
  it("lists only the sources the version cites", () => {
    expect(citedSources(content, sources).map((s) => s.label)).toEqual(["S1", "S3"]);
  });
});

describe("shortCredit", () => {
  it("removes titles and links from older one-source credits", () => {
    const old = 'Pinagmulan: Ang ulat na ito ay batay sa CLTV36 ("Kambal na sanggol", https://cltv36.tv/kambal-%e2%82%b130-k/).';
    expect(shortCredit(old)).toBe("Pinagmulan: Ang ulat na ito ay batay sa CLTV36.");
  });

  it("handles older credits with several sources and quotes in titles", () => {
    const old = 'Source credit: This report is based on A ("One "quoted" title", https://a.example/x); B ("Two", https://b.example/y) and C ("Three", https://c.example/z).';
    expect(shortCredit(old)).toBe("Source credit: This report is based on A; B and C.");
  });

  it("leaves new credits unchanged", () => {
    expect(shortCredit(content.credit)).toBe(content.credit);
  });
});

describe("readableUrl", () => {
  it("shows the peso sign instead of its encoding", () => {
    expect(readableUrl("https://cltv36.tv/halagang-%e2%82%b130-k/")).toBe("https://cltv36.tv/halagang-₱30-k/");
  });

  it("returns a malformed link unchanged", () => {
    expect(readableUrl("https://x.example/%e2%82")).toBe("https://x.example/%e2%82");
  });
});

describe("articleAsText", () => {
  it("ends with a numbered list of source links", () => {
    const text = articleAsText(content, "A Reporter", sources, "English");
    expect(text).toContain("By A Reporter");
    expect(text.endsWith("Sources:\n1. GMA News: First title\nhttps://gma.example/one\n2. Rappler: Third title\nhttps://rappler.example/three")).toBe(true);
    expect(text).not.toContain("Not cited");
  });

  it("uses a Filipino heading for Filipino versions", () => {
    expect(sourcesHeading("Filipino")).toBe("Mga Pinagmulan");
    expect(articleAsText(content, null, sources, "Filipino")).toContain("Mga Pinagmulan:\n1. GMA News");
  });
});
