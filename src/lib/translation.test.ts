import { describe, expect, it } from "vitest";
import { applyTranslation, numbersChanged } from "@/lib/pipeline";
import type { Sentence, VersionContent } from "@/lib/types";

const sentence = (id: string, text: string): Sentence => ({
  id,
  text,
  factIds: ["F1"],
  evidence: [{ source: "S1", paragraph: 1, quote: "a quoted passage" }],
});

const content: VersionContent = {
  headline: sentence("headline", "Two rescued"),
  dek: sentence("dek", "Police acted"),
  paragraphs: [[sentence("s1", "First."), sentence("s2", "Second.")]],
  credit: "Credit.",
};

const all = [
  { id: "headline", text: "Dalawa, nasagip" },
  { id: "dek", text: "Kumilos ang pulisya" },
  { id: "s1", text: "Una." },
  { id: "s2", text: " Ikalawa. " },
];

describe("numbersChanged", () => {
  it("catches a changed amount", () => {
    expect(numbersChanged("Shipping is P150 for deliveries.", "Ang singil ay P50 para sa delivery.")).toBe(true);
  });

  it("catches a dropped number", () => {
    expect(numbersChanged("Prices start at P350.", "Mura ang presyo.")).toBe(true);
  });

  it("accepts the same figures in another language", () => {
    expect(numbersChanged("On Oct. 31 at 3 p.m., P1,200 was paid.", "Noong Oktubre 31 dakong alas-3, nagbayad ng P1200.")).toBe(false);
  });

  it("accepts sentences with no figures", () => {
    expect(numbersChanged("Police arrived.", "Dumating ang pulisya.")).toBe(false);
  });
});

describe("applyTranslation", () => {
  it("translates every sentence and keeps its evidence", () => {
    const result = applyTranslation(content, all)!;
    expect(result.headline.text).toBe("Dalawa, nasagip");
    expect(result.paragraphs[0][1].text).toBe("Ikalawa.");
    expect(result.paragraphs[0][0].evidence).toEqual(content.paragraphs[0][0].evidence);
    expect(result.paragraphs[0][0].factIds).toEqual(["F1"]);
  });

  it("does not change the original version", () => {
    applyTranslation(content, all);
    expect(content.headline.text).toBe("Two rescued");
  });

  it("refuses a partial translation, so languages never mix", () => {
    expect(applyTranslation(content, all.slice(0, 3))).toBeNull();
  });

  it("refuses an empty translation", () => {
    expect(applyTranslation(content, [...all.slice(0, 3), { id: "s2", text: "   " }])).toBeNull();
  });
});
