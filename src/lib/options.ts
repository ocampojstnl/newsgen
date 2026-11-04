export const MAX_VERSIONS = 5;
export const WORDS_PER_MINUTE = 200;

/** words: null means no target. The story runs as long as its facts need, like a typical news story. */
export const PRESETS: { id: string; label: string; words: number | null; hint: string }[] = [
  { id: "natural", label: "Natural length", words: null, hint: "No word limit, as long as the news needs" },
  { id: "full", label: "Full report", words: 1000, hint: "About 1,000 words" },
  { id: "standard", label: "Standard story", words: 600, hint: "About 600 words" },
  { id: "two-min", label: "2-minute read", words: 2 * WORDS_PER_MINUTE, hint: "About 400 words" },
  { id: "one-min", label: "1-minute read", words: WORDS_PER_MINUTE, hint: "About 200 words" },
  { id: "brief", label: "News brief", words: 100, hint: "About 100 words" },
];

export const TONES = {
  "straight-news": {
    label: "Straight news",
    instruction: "Inverted pyramid. Neutral, formal news style with the most important facts first.",
  },
  explainer: {
    label: "Explainer",
    instruction: "Clear explanatory structure for a general reader, still strictly neutral.",
  },
  broadcast: {
    label: "Broadcast script",
    instruction: "Short spoken-style sentences suitable for reading aloud on air.",
  },
  plain: {
    label: "Plain language",
    instruction: "Simple everyday words and short sentences, still strictly neutral.",
  },
} as const;

export type ToneId = keyof typeof TONES;

export const LANGUAGES = {
  English: {
    label: "English",
    creditPrefix: "Source credit: This report is based on reports from",
    sourcesHeading: "Sources",
  },
  Filipino: {
    label: "Filipino",
    creditPrefix: "Pinagmulan: Ang ulat na ito ay batay sa mga ulat ng",
    sourcesHeading: "Mga Pinagmulan",
  },
} as const;

export type LanguageId = keyof typeof LANGUAGES;

const FILIPINO_WORDS = new Set("ang ng mga sa na ay si ni at para hindi ito kay nito naman dahil siya sila kanilang ayon".split(" "));
const ENGLISH_WORDS = new Set("the of and to in is was were for that on with said from by as at his her".split(" "));

/** Picks the form's starting language by counting common words. The reporter can still change it. */
export function detectLanguage(paragraphs: string[]): LanguageId {
  let filipino = 0;
  let english = 0;
  for (const word of paragraphs
    .join(" ")
    .toLowerCase()
    .match(/\p{L}+/gu) ?? []) {
    if (FILIPINO_WORDS.has(word)) filipino += 1;
    if (ENGLISH_WORDS.has(word)) english += 1;
  }
  return filipino > english ? "Filipino" : "English";
}

export function readingMinutes(words: number): string {
  const minutes = words / WORDS_PER_MINUTE;
  return minutes < 1 ? "under 1 min read" : `${Math.round(minutes)} min read`;
}
