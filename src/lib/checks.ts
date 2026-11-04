import type { Conflict, Evidence, Fact, Sentence, Source } from "@/lib/types";

// These checks are plain code, not AI, so their results do not depend on the model.

const COPY_NGRAM = 5;
const COPY_FLAG_WORDS = 8;

const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
};

export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): string[] {
  return normalize(text).match(/[\p{L}\p{N}]+(?:['.,-][\p{L}\p{N}]+)*/gu) ?? [];
}

export function countWords(text: string): number {
  return words(text).length;
}

/** Keeps only evidence whose quote really appears in the captured source, correcting a wrong paragraph number. */
export function validateFacts(
  rawFacts: Fact[],
  rawConflicts: Conflict[],
  sources: Pick<Source, "label" | "paragraphs">[],
): { facts: Fact[]; conflicts: Conflict[]; dropped: number } {
  const byLabel = new Map(sources.map((s) => [s.label, s.paragraphs.map(normalize)]));
  const facts: Fact[] = [];
  let dropped = 0;

  for (const fact of rawFacts) {
    const evidence: Evidence[] = [];
    for (const item of fact.evidence) {
      const paragraphs = byLabel.get(item.source);
      const quote = normalize(item.quote);
      if (!paragraphs || quote.length < 8) continue;
      const stated = paragraphs[item.paragraph - 1]?.includes(quote) ? item.paragraph - 1 : -1;
      const index = stated >= 0 ? stated : paragraphs.findIndex((p) => p.includes(quote));
      if (index >= 0) evidence.push({ ...item, paragraph: index + 1 });
    }
    if (evidence.length > 0) facts.push({ ...fact, evidence });
    else dropped += 1;
  }

  const kept = new Set(facts.map((f) => f.id));
  const conflicts = rawConflicts
    .map((c) => ({ ...c, factIds: c.factIds.filter((id) => kept.has(id)) }))
    .filter((c) => c.factIds.length > 0);
  return { facts, conflicts, dropped };
}

const QUOTE_PATTERN = /["“]([^"“”]+)["”]/g;

function extractQuotes(text: string): string[] {
  return [...text.matchAll(QUOTE_PATTERN)].map((m) => m[1].trim()).filter((q) => q.split(/\s+/).length >= 3);
}

function stripEdgePunctuation(text: string): string {
  return text.replace(/^[\s,.;:!?'-]+|[\s,.;:!?'-]+$/g, "");
}

/** Direct quotations must exist word for word in the sources. */
export function findUnverifiedQuotes(text: string, sources: Pick<Source, "paragraphs">[]): string[] {
  const corpus = sources.flatMap((s) => s.paragraphs.map(normalize));
  return extractQuotes(text).filter((quote) => {
    const needle = stripEdgePunctuation(normalize(quote));
    return !corpus.some((p) => p.includes(needle));
  });
}

function numbersIn(text: string): Set<string> {
  const found = new Set<string>();
  const clean = normalize(text);
  for (const match of clean.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    found.add(match[0].replace(/,/g, "").replace(/\.0+$/, ""));
  }
  return found;
}

function numbersWithWords(text: string): Set<string> {
  const found = numbersIn(text);
  for (const word of words(text)) {
    if (NUMBER_WORDS[word]) found.add(NUMBER_WORDS[word]);
  }
  return found;
}

/** Every figure in a sentence must appear in the source paragraphs it cites. */
export function findUnmatchedNumbers(text: string, citedParagraphs: string[]): string[] {
  const available = numbersWithWords(citedParagraphs.join(" "));
  return [...numbersIn(text)].filter((n) => !available.has(n));
}

export function citedParagraphs(
  evidence: Evidence[],
  sources: Pick<Source, "label" | "paragraphs">[],
): string[] {
  const seen = new Set<string>();
  const paragraphs: string[] = [];
  for (const item of evidence) {
    const key = `${item.source}-${item.paragraph}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const text = sources.find((s) => s.label === item.source)?.paragraphs[item.paragraph - 1];
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

export class CopyDetector {
  private readonly grams = new Set<string>();

  constructor(sources: Pick<Source, "paragraphs">[]) {
    for (const source of sources) {
      for (const paragraph of source.paragraphs) {
        const tokens = words(paragraph);
        for (let i = 0; i + COPY_NGRAM <= tokens.length; i++) {
          this.grams.add(tokens.slice(i, i + COPY_NGRAM).join(" "));
        }
      }
    }
  }

  private covered(text: string): { tokens: string[]; marks: boolean[] } {
    // Attributed direct quotations are allowed to match the source exactly.
    const tokens = words(text.replace(QUOTE_PATTERN, " | "));
    const marks = new Array<boolean>(tokens.length).fill(false);
    for (let i = 0; i + COPY_NGRAM <= tokens.length; i++) {
      if (this.grams.has(tokens.slice(i, i + COPY_NGRAM).join(" "))) {
        marks.fill(true, i, i + COPY_NGRAM);
      }
    }
    return { tokens, marks };
  }

  /** Returns the longest run copied from a source, when it is long enough to be a concern. */
  copiedPhrase(text: string): string | null {
    const { tokens, marks } = this.covered(text);
    let best: [number, number] = [0, 0];
    let start = -1;
    for (let i = 0; i <= marks.length; i++) {
      if (marks[i] && start < 0) start = i;
      if (!marks[i] && start >= 0) {
        if (i - start > best[1] - best[0]) best = [start, i];
        start = -1;
      }
    }
    return best[1] - best[0] >= COPY_FLAG_WORDS ? tokens.slice(best[0], best[1]).join(" ") : null;
  }

  overlapPercent(sentences: Pick<Sentence, "text">[]): number {
    let total = 0;
    let copied = 0;
    for (const sentence of sentences) {
      const { marks } = this.covered(sentence.text);
      total += marks.length;
      copied += marks.filter(Boolean).length;
    }
    return total === 0 ? 0 : Math.round((copied / total) * 100);
  }
}
