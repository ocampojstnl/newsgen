import Parser from "rss-parser";
import { GOOGLE_NEWS_OUTLET_ID, isGoogleNewsLink, OUTLETS, type FeedConfig, type Outlet } from "@/lib/catalog";
import { correctFutureDate } from "@/lib/format";
import { safeFetchText } from "@/lib/safe-fetch";
import { cleanText, decodeEntities } from "@/lib/text";
import type { FeedItem, OutletStatus } from "@/lib/types";

const CACHE_MS = 5 * 60 * 1000;
const parser = new Parser();
const cache = new Map<string, { at: number; items: FeedItem[] }>();

function stripHtml(html: string): string {
  return cleanText(decodeEntities(html).replace(/<[^>]*>/g, " "));
}

function toItem(
  outlet: Outlet,
  title: string,
  url: string,
  publishedAt: string | null,
  summary: string,
): FeedItem {
  const date = publishedAt ? new Date(publishedAt) : null;
  return {
    id: url,
    outletId: outlet.id,
    outletName: outlet.name,
    title: stripHtml(title),
    url,
    publishedAt: date && !Number.isNaN(date.getTime()) ? correctFutureDate(date).toISOString() : null,
    summary: stripHtml(summary).slice(0, 800),
    readable: outlet.readable && !isGoogleNewsLink(url),
  };
}

async function readRss(outlet: Outlet, feed: FeedConfig): Promise<FeedItem[]> {
  const { text } = await safeFetchText(feed.url, 15_000);
  const parsed = await parser.parseString(text);
  return parsed.items.flatMap((item) => {
    if (!item.link || !item.title) return [];
    const url = new URL(item.link);
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_")) url.searchParams.delete(key);
    }
    // Google News titles end in " - Outlet Name".
    const fromGoogle = url.hostname === "news.google.com";
    // Split on the last " - " because publisher names can contain hyphens, as in ABS-CBN.
    const split = fromGoogle ? item.title.lastIndexOf(" - ") : -1;
    const title = split > 0 ? item.title.slice(0, split) : item.title;
    const summary = fromGoogle ? "" : (item.contentSnippet ?? item.summary ?? "");
    const feedItem = toItem(outlet, title, url.toString(), item.isoDate ?? item.pubDate ?? null, summary);
    if (outlet.id === GOOGLE_NEWS_OUTLET_ID && split > 0) feedItem.outletName = item.title.slice(split + 3).trim();
    return [feedItem];
  });
}

type QuintypeCollection = {
  items?: {
    type?: string;
    story?: {
      headline?: string;
      url?: string;
      subheadline?: string | null;
      "published-at"?: number;
      "last-published-at"?: number;
    };
  }[];
};

async function readQuintype(outlet: Outlet, feed: FeedConfig): Promise<FeedItem[]> {
  const { text } = await safeFetchText(feed.url, 15_000);
  const data = JSON.parse(text) as QuintypeCollection;
  return (data.items ?? []).flatMap(({ story }) => {
    if (!story?.headline || !story.url) return [];
    const stamp = story["published-at"] ?? story["last-published-at"];
    return [
      toItem(
        outlet,
        story.headline,
        story.url,
        stamp ? new Date(stamp).toISOString() : null,
        story.subheadline ?? "",
      ),
    ];
  });
}

/** PNA has no RSS feed, but its home page lists articles and its robots.txt allows reading them. */
export function parsePnaHome(html: string): { title: string; url: string; publishedAt: string | null }[] {
  const seen = new Set<string>();
  const items: { title: string; url: string; publishedAt: string | null }[] = [];
  for (const match of html.matchAll(/<a href="(\/article\/[^"]+)"[^>]*aria-label="([^"]+)"/g)) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    const after = html.slice(match.index, match.index + 800);
    const stamp = after.match(/<p>([A-Z][a-z]{2} \d{1,2}, \d{4}) · (\d{1,2}:\d{2} [AP]M)<\/p>/);
    items.push({
      title: decodeEntities(match[2]),
      url: `https://www.pna.gov.ph${match[1]}`,
      publishedAt: stamp ? `${stamp[1]} ${stamp[2]} GMT+0800` : null,
    });
  }
  return items;
}

async function readPna(outlet: Outlet, feed: FeedConfig): Promise<FeedItem[]> {
  const { text } = await safeFetchText(feed.url, 15_000);
  const items = parsePnaHome(text);
  if (items.length === 0) throw new Error("No articles were found on the PNA home page.");
  return items.map((item) => toItem(outlet, item.title, item.url, item.publishedAt, ""));
}

async function readOutlet(outlet: Outlet): Promise<FeedItem[]> {
  const cached = cache.get(outlet.id);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.items;

  const readers = { rss: readRss, quintype: readQuintype, pna: readPna };
  const readFeed = (feed: FeedConfig) => readers[feed.format](outlet, feed);
  const results = await Promise.allSettled(outlet.feeds.map(readFeed));
  const fulfilled = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (fulfilled.length === 0 && outlet.fallbackFeed) {
    fulfilled.push(await readFeed(outlet.fallbackFeed));
  }
  if (fulfilled.length === 0) {
    const first = results[0];
    throw first?.status === "rejected" ? first.reason : new Error("Feed unavailable");
  }
  const unique = new Map(fulfilled.flat().map((item) => [item.url, item]));
  const items = [...unique.values()];
  cache.set(outlet.id, { at: Date.now(), items });
  return items;
}

export async function loadAllFeeds(): Promise<{ items: FeedItem[]; statuses: OutletStatus[] }> {
  const results = await Promise.allSettled(OUTLETS.map(readOutlet));
  const statuses: OutletStatus[] = [];
  const items: FeedItem[] = [];
  results.forEach((result, index) => {
    const outletId = OUTLETS[index].id;
    if (result.status === "fulfilled") {
      items.push(...result.value);
      statuses.push({ outletId, ok: true, count: result.value.length });
    } else {
      const error = result.reason instanceof Error ? result.reason.message : "Feed unavailable";
      statuses.push({ outletId, ok: false, count: 0, error });
    }
  });
  items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return { items, statuses };
}
