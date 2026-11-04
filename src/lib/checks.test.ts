import { describe, expect, it } from "vitest";
import {
  CopyDetector,
  findUnmatchedNumbers,
  findUnverifiedQuotes,
  validateFacts,
} from "@/lib/checks";
import { correctFutureDate } from "@/lib/format";
import { isPrivateAddress } from "@/lib/safe-fetch";

const sources = [
  {
    label: "S1",
    paragraphs: [
      "The Pampanga provincial government said on Monday that three bridges in Guagua were damaged by floods.",
      "“We will repair them before December,” Governor Santos told reporters at the capitol.",
      "Repairs are estimated to cost P1,200,000 according to the engineering office.",
    ],
  },
];

describe("validateFacts", () => {
  const fact = (id: string, quote: string, paragraph: number) => ({
    id,
    statement: "x",
    attributedTo: null,
    evidence: [{ source: "S1", paragraph, quote }],
  });

  it("keeps a real quote and tolerates curly quotes and spacing", () => {
    const { facts } = validateFacts([fact("F1", '"We  will repair them before December,"', 2)], [], sources);
    expect(facts).toHaveLength(1);
  });

  it("corrects a wrong paragraph number", () => {
    const { facts } = validateFacts([fact("F1", "estimated to cost P1,200,000", 1)], [], sources);
    expect(facts[0].evidence[0].paragraph).toBe(3);
  });

  it("drops a fact whose quote is invented, and its conflict reference", () => {
    const result = validateFacts(
      [fact("F1", "the governor admitted taking bribes", 1)],
      [{ description: "d", factIds: ["F1"] }],
      sources,
    );
    expect(result.facts).toHaveLength(0);
    expect(result.dropped).toBe(1);
    expect(result.conflicts).toHaveLength(0);
  });

  it("drops evidence pointing at an unknown source", () => {
    const bad = { ...fact("F1", "three bridges in Guagua", 1) };
    bad.evidence = [{ source: "S9", paragraph: 1, quote: "three bridges in Guagua" }];
    expect(validateFacts([bad], [], sources).facts).toHaveLength(0);
  });
});

describe("findUnverifiedQuotes", () => {
  it("accepts an exact quotation", () => {
    expect(findUnverifiedQuotes('Santos said, "We will repair them before December."', sources)).toEqual([]);
  });

  it("rejects an altered quotation", () => {
    expect(findUnverifiedQuotes('Santos said, "We will finish them before January."', sources)).toEqual([
      "We will finish them before January.",
    ]);
  });
});

describe("findUnmatchedNumbers", () => {
  const cited = sources[0].paragraphs;

  it("matches comma formats and spelled-out numbers", () => {
    expect(findUnmatchedNumbers("Repairs cost P1200000 for 3 bridges.", cited)).toEqual([]);
  });

  it("flags a figure that is not in the cited text", () => {
    expect(findUnmatchedNumbers("Repairs cost P2,500,000.", cited)).toEqual(["2500000"]);
  });
});

describe("CopyDetector", () => {
  const detector = new CopyDetector(sources);

  it("flags a long copied run", () => {
    const text = "Officials said three bridges in Guagua were damaged by floods on Monday.";
    expect(detector.copiedPhrase(text)).toBe("three bridges in guagua were damaged by floods");
  });

  it("does not flag independently written text", () => {
    expect(detector.copiedPhrase("Floodwaters left a trio of Guagua spans unusable, the province reported.")).toBeNull();
  });

  it("does not count an attributed direct quotation as copying", () => {
    const text = 'Santos said, "We will repair them before December," at the capitol.';
    expect(detector.copiedPhrase(text)).toBeNull();
  });

  it("reports a percentage", () => {
    const all = sources[0].paragraphs[0];
    expect(detector.overlapPercent([{ text: all }])).toBe(100);
    expect(detector.overlapPercent([{ text: "Completely different wording about something else here." }])).toBe(0);
  });
});

describe("correctFutureDate", () => {
  const now = Date.parse("2026-11-02T14:25:00Z");

  it("fixes Manila time mislabelled as UTC", () => {
    const fixed = correctFutureDate(new Date("2026-11-02T21:52:58Z"), now);
    expect(fixed.toISOString()).toBe("2026-11-02T13:52:58.000Z");
  });

  it("leaves correct dates alone", () => {
    const date = new Date("2026-11-02T14:00:00Z");
    expect(correctFutureDate(date, now)).toBe(date);
  });

  it("caps a date that is still in the future at now", () => {
    expect(correctFutureDate(new Date("2027-01-01T00:00:00Z"), now).getTime()).toBe(now);
  });
});

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "172.16.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it.each(["8.8.8.8", "172.32.0.1", "2606:4700::1111"])("allows %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});
