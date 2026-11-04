import { createHash } from "node:crypto";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { FetchRefusedError, safeFetchText } from "@/lib/safe-fetch";
import { cleanText } from "@/lib/text";

export type CapturedArticle = {
  url: string;
  title: string;
  author: string | null;
  publishedAt: string | null;
  paragraphs: string[];
  sha256: string;
};

const BOILERPLATE = [
  /^[-–—\s]*(advertisements?|read more|read:|also read|related:|related stories|share this|follow us|subscribe)\b/i,
  /^by\s[^.]{0,60}$/i, // Byline
  /^[\p{L}.' ]{3,50}\s[-–—]\s[\w.]+\.(com|net|ph|org)$/iu, // "Name - Outlet.com"
  /^[A-Z][a-z]+ \d{1,2}, \d{4}\s*\|?\s*(\d{1,2}:\d{2}\s*[ap]m)?$/i, // Date line
  /^(published|updated|posted)\s+[A-Z][a-z]+ \d{1,2}, \d{4}\b[^.]{0,30}$/i, // "Published November 5, 2026 1:06am"
  /^make (this|us) your preferred source\b/i, // Google preferred-source prompt
];

export function sha256OfParagraphs(paragraphs: string[]): string {
  return createHash("sha256").update(JSON.stringify(paragraphs)).digest("hex");
}

/** Rappler opens articles with a labelled AI summary. Evidence must come from the reported text. */
function withoutAiSummary(paragraphs: string[]): string[] {
  const end = paragraphs.findIndex((text) => /^this is ai-generated\b/i.test(text));
  if (end < 0) return paragraphs;
  const heading = paragraphs.slice(0, end).findIndex((text) => /^at a glance$/i.test(text));
  // Without the heading, only the label line itself can be identified safely.
  return [...paragraphs.slice(0, heading >= 0 ? heading : end), ...paragraphs.slice(end + 1)];
}

export function paragraphsFromHtml(html: string): string[] {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const blocks = [...document.querySelectorAll("p, li, blockquote, h2, h3")].filter(
    // Keep the innermost block so nested text such as <li><p> is not captured twice.
    (el) => !el.querySelector("p, li, blockquote"),
  );
  const paragraphs = blocks
    .map((el) => cleanText(el.textContent ?? ""))
    .filter((text) => text.split(" ").length >= 3 && !BOILERPLATE.some((pattern) => pattern.test(text)));
  return withoutAiSummary(paragraphs);
}

export function paragraphsFromPaste(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .map(cleanText)
    .filter((line) => line.length > 0 && !BOILERPLATE.some((pattern) => pattern.test(line)));
}

export function extractArticle(html: string, url: string): Omit<CapturedArticle, "sha256" | "url"> | null {
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
  if (!article?.content) return null;
  const paragraphs = paragraphsFromHtml(article.content);
  const words = paragraphs.join(" ").split(/\s+/).length;
  if (paragraphs.length < 2 || words < 60) return null;
  const publishedAt = article.publishedTime ? new Date(article.publishedTime) : null;
  return {
    title: cleanText(article.title ?? url),
    author: article.byline ? cleanText(article.byline) : null,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : null,
    paragraphs,
  };
}

export async function captureArticle(url: string): Promise<CapturedArticle> {
  const { text, finalUrl } = await safeFetchText(url);
  const extracted = extractArticle(text, finalUrl);
  if (!extracted) {
    throw new FetchRefusedError("No article text was found on that page (it may be a video or gallery).");
  }
  return { ...extracted, url: finalUrl, sha256: sha256OfParagraphs(extracted.paragraphs) };
}
