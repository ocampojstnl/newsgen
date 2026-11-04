import { LANGUAGES, type LanguageId } from "@/lib/options";
import type { Sentence, VersionContent } from "@/lib/types";

type ListedSource = { label: string; outlet_name: string; title: string; url: string };

/** Builds a browser "text fragment" link that scrolls to and highlights the quote on the original page. */
export function evidenceLink(url: string, quote: string): string {
  if (url.includes("news.google.com")) return url;
  const clean = quote.replace(/^["“”\s]+|["”“\s]+$/g, "");
  const tokens = clean.split(/\s+/);
  const fragment =
    tokens.length > 10
      ? `${encodeURIComponent(tokens.slice(0, 5).join(" "))},${encodeURIComponent(tokens.slice(-4).join(" "))}`
      : encodeURIComponent(clean);
  return `${url.split("#")[0]}#:~:text=${fragment}`;
}

export function allSentences(content: VersionContent): Sentence[] {
  return [content.headline, ...(content.dek ? [content.dek] : []), ...content.paragraphs.flat()];
}

/** The sources this version actually cites, in label order. */
export function citedSources<T extends { label: string }>(content: VersionContent, sources: T[]): T[] {
  const used = new Set(allSentences(content).flatMap((s) => s.evidence.map((e) => e.source)));
  return sources.filter((s) => used.has(s.label));
}

/** Older versions kept titles and links inside the credit sentence. They now appear in the source list. */
export function shortCredit(credit: string): string {
  return credit.replace(/\s*\(".*?", https?:\/\/\S*?\)(?=;| and | at |\.$)/g, "");
}

export function captureLabel(method: "page" | "pasted" | "browser"): string {
  if (method === "pasted") return "Pasted by the reporter";
  return method === "browser" ? "Captured in the reporter's browser" : "Captured from the page";
}

/** Shows Philippine peso signs and other encoded characters in links as readable text. */
export function readableUrl(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

export function sourcesHeading(language: string): string {
  return LANGUAGES[language as LanguageId]?.sourcesHeading ?? LANGUAGES.English.sourcesHeading;
}

export function articleAsText(content: VersionContent, byline: string | null, sources: ListedSource[], language: string): string {
  const lines = [content.headline.text];
  if (content.dek) lines.push(content.dek.text);
  if (byline) lines.push(`By ${byline}`);
  for (const paragraph of content.paragraphs) lines.push(paragraph.map((s) => s.text).join(" "));
  lines.push(shortCredit(content.credit));
  const cited = citedSources(content, sources);
  if (cited.length > 0) {
    const list = cited.map((s, index) => `${index + 1}. ${s.outlet_name}: ${s.title}\n${s.url}`);
    lines.push(`${sourcesHeading(language)}:\n${list.join("\n")}`);
  }
  return lines.join("\n\n");
}
