import { z } from "zod";
import { ApiError } from "@/lib/api";
import { query } from "@/lib/db";
import { findOutletByUrl, GOOGLE_NEWS_OUTLET_ID, isGoogleNewsLink, OUTLETS } from "@/lib/catalog";
import { captureArticle, paragraphsFromPaste, sha256OfParagraphs } from "@/lib/extract";
import { isWebUrl } from "@/lib/import";
import { FetchRefusedError } from "@/lib/safe-fetch";
import { cleanText } from "@/lib/text";
import type { PendingSource, Source } from "@/lib/types";

export const MAX_SOURCES = 6;
const MIN_PASTED_WORDS = 40;

type SourceRow = Omit<Source, "id" | "label" | "fetched_at">;

export const sourceRequest = z.object({
  url: z.string().max(2000).refine(isWebUrl),
  title: z.string().max(500).optional(),
  outletId: z.string().max(100).nullable().optional(),
  outletName: z.string().max(200).optional(),
});

function outletFor(url: string, outletId?: string | null) {
  // Credit goes to the publisher of the article link. Google News is never the credited source.
  const listed = outletId === GOOGLE_NEWS_OUTLET_ID ? undefined : OUTLETS.find((o) => o.id === outletId);
  const outlet = findOutletByUrl(url) ?? listed;
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // The URL was validated by the request schema, so this only guards odd values.
  }
  return { outletId: outlet?.id ?? null, outletName: outlet?.name ?? host, readable: outlet?.readable ?? true };
}

export function toPending(request: z.infer<typeof sourceRequest>, reason: string): PendingSource {
  const outlet = outletFor(request.url, request.outletId);
  return {
    url: request.url,
    title: request.title ?? request.url,
    outletId: outlet.outletId,
    outletName: request.outletName ?? outlet.outletName,
    reason,
  };
}

export const NOT_READABLE_REASON = "This site does not allow automated reading. Open it and paste the article text.";

function rowFromParagraphs(input: { url: string; title: string; paragraphs: string[]; outletId?: string | null; captureMethod: SourceRow["capture_method"] }): SourceRow {
  const outlet = outletFor(input.url, input.outletId);
  return {
    outlet_id: outlet.outletId,
    outlet_name: outlet.outletName,
    url: input.url,
    title: input.title,
    author: null,
    published_at: null,
    capture_method: input.captureMethod,
    paragraphs: input.paragraphs,
    content_sha256: sha256OfParagraphs(input.paragraphs),
  };
}

/** Reads one article from the web if the site allows it. Returns the data to store, or why it could not be read. */
export async function captureForStory(request: z.infer<typeof sourceRequest>): Promise<{ row: SourceRow; pending?: undefined } | { row?: undefined; pending: PendingSource }> {
  const outlet = outletFor(request.url, request.outletId);
  let reason = NOT_READABLE_REASON;

  if (outlet.readable && !isGoogleNewsLink(request.url)) {
    try {
      const article = await captureArticle(request.url);
      return {
        row: {
          outlet_id: outlet.outletId,
          outlet_name: outlet.outletName,
          url: article.url,
          title: article.title,
          author: article.author,
          published_at: article.publishedAt,
          capture_method: "page",
          paragraphs: article.paragraphs,
          content_sha256: article.sha256,
        },
      };
    } catch (error) {
      reason = error instanceof FetchRefusedError ? error.message : "The article could not be reached. Paste its text instead.";
    }
  }

  return { pending: toPending(request, reason) };
}

export function pastedRow(input: { url: string; title: string; text: string; outletId?: string | null }): SourceRow {
  if (isGoogleNewsLink(input.url)) {
    throw new ApiError(400, "Enter the original article link, not the Google News link, so the evidence points to the real page.");
  }
  const paragraphs = paragraphsFromPaste(input.text);
  if (paragraphs.join(" ").split(/\s+/).length < MIN_PASTED_WORDS) {
    throw new ApiError(400, "Paste the full article text. That is too short to work from.");
  }
  return rowFromParagraphs({ url: input.url, title: cleanText(input.title), paragraphs, outletId: input.outletId, captureMethod: "pasted" });
}

export async function insertSource(storyId: string, existing: Pick<Source, "label" | "url">[], row: SourceRow): Promise<Source> {
  if (existing.some((s) => s.url === row.url)) throw new ApiError(409, "That article is already in this story.");
  if (existing.length >= MAX_SOURCES) throw new ApiError(400, `A story can use up to ${MAX_SOURCES} sources.`);
  const [source] = await query<Source>(
    `insert into public.sources
       (story_id, label, outlet_id, outlet_name, url, title, author, published_at, capture_method, paragraphs, content_sha256)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning *`,
    [
      storyId,
      `S${existing.length + 1}`,
      row.outlet_id,
      row.outlet_name,
      row.url,
      row.title,
      row.author,
      row.published_at,
      row.capture_method,
      JSON.stringify(row.paragraphs),
      row.content_sha256,
    ],
  );
  return source;
}
