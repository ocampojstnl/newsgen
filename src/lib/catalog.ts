export type FeedConfig = {
  url: string;
  format: "rss" | "quintype" | "pna";
};

export type Outlet = {
  id: string;
  name: string;
  category: CategoryId;
  hosts: string[];
  feeds: FeedConfig[];
  /** Used only when every feed above fails. */
  fallbackFeed?: FeedConfig;
  /** False when the site refuses automated reads, so the reporter pastes the text instead. */
  readable: boolean;
};

export const CATEGORIES = [
  { id: "broadcast", name: "TV & Radio" },
  { id: "national", name: "National News" },
  { id: "pampanga", name: "Pampanga & Central Luzon" },
  { id: "regional", name: "Other Regional" },
  { id: "government", name: "Government" },
  { id: "aggregator", name: "Aggregators" },
] as const;

export const GOOGLE_NEWS_OUTLET_ID = "google-news-ph";

export type CategoryId = (typeof CATEGORIES)[number]["id"];

const rss = (url: string): FeedConfig => ({ url, format: "rss" });

// Headline listing for outlets without a usable public feed. Links go through
// Google News, so these stories are always added by pasting the article text.
const googleNews = (site: string): FeedConfig =>
  rss(`https://news.google.com/rss/search?q=site:${site}+when:3d&hl=en-PH&gl=PH&ceid=PH:en`);

export const OUTLETS: Outlet[] = [
  {
    id: "gma",
    name: "GMA News",
    category: "broadcast",
    hosts: ["gmanetwork.com"],
    feeds: [
      rss("https://data.gmanetwork.com/gno/rss/news/feed.xml"),
      rss("https://data.gmanetwork.com/gno/rss/news/regions/feed.xml"),
    ],
    readable: true,
  },
  {
    id: "abs-cbn",
    name: "ABS-CBN News",
    category: "broadcast",
    hosts: ["abs-cbn.com"],
    feeds: [rss("https://www.abs-cbn.com/feed")],
    fallbackFeed: googleNews("abs-cbn.com"),
    readable: true,
  },
  {
    id: "tv5",
    name: "TV5 / News5",
    category: "broadcast",
    hosts: ["tv5.com.ph", "news5.com.ph"],
    feeds: [googleNews("news.tv5.com.ph")],
    readable: false,
  },
  {
    id: "bombo",
    name: "Bombo Radyo",
    category: "broadcast",
    hosts: ["bomboradyo.com"],
    feeds: [rss("https://www.bomboradyo.com/feed/")],
    readable: true,
  },
  {
    id: "inquirer",
    name: "Inquirer.net",
    category: "national",
    hosts: ["inquirer.net"],
    feeds: [rss("https://newsinfo.inquirer.net/feed")],
    readable: false,
  },
  {
    id: "philstar",
    name: "Philstar",
    category: "national",
    hosts: ["philstar.com"],
    feeds: [rss("https://www.philstar.com/rss/headlines")],
    readable: true,
  },
  {
    id: "rappler",
    name: "Rappler",
    category: "national",
    hosts: ["rappler.com"],
    feeds: [rss("https://www.rappler.com/feed/")],
    readable: true,
  },
  {
    id: "manila-times",
    name: "The Manila Times",
    category: "national",
    hosts: ["manilatimes.net"],
    feeds: [rss("https://www.manilatimes.net/news/feed/")],
    readable: true,
  },
  {
    id: "manila-bulletin",
    name: "Manila Bulletin",
    category: "national",
    hosts: ["mb.com.ph"],
    feeds: [googleNews("mb.com.ph")],
    readable: false,
  },
  {
    id: "bworld",
    name: "BusinessWorld",
    category: "national",
    hosts: ["bworldonline.com"],
    feeds: [rss("https://www.bworldonline.com/feed/")],
    readable: true,
  },
  {
    id: "sunstar-pampanga",
    name: "SunStar Pampanga",
    category: "pampanga",
    hosts: [],
    feeds: [
      {
        url: "https://www.sunstar.com.ph/api/v1/collections/local-news-pampanga?limit=30",
        format: "quintype",
      },
    ],
    readable: true,
  },
  {
    id: "punto",
    name: "Punto! Central Luzon",
    category: "pampanga",
    hosts: ["punto.com.ph"],
    feeds: [rss("https://punto.com.ph/feed/")],
    readable: true,
  },
  {
    id: "cltv36",
    name: "CLTV36",
    category: "pampanga",
    hosts: ["cltv36.tv"],
    feeds: [rss("https://cltv36.tv/feed/")],
    readable: true,
  },
  {
    id: "pampanga-news-now",
    name: "Pampanga News Now",
    category: "pampanga",
    hosts: ["pampanganewsnow.com"],
    feeds: [rss("https://pampanganewsnow.com/feed/")],
    readable: true,
  },
  {
    id: "sunstar",
    name: "SunStar Philippines",
    category: "regional",
    hosts: ["sunstar.com.ph"],
    feeds: [rss("https://www.sunstar.com.ph/feed")],
    readable: true,
  },
  {
    id: "pna",
    name: "Philippine News Agency",
    category: "government",
    hosts: ["pna.gov.ph"],
    feeds: [{ url: "https://www.pna.gov.ph/", format: "pna" }],
    fallbackFeed: googleNews("pna.gov.ph"),
    readable: true,
  },
  {
    // Finds stories across many outlets. Each item shows and credits its real publisher, never Google.
    id: GOOGLE_NEWS_OUTLET_ID,
    name: "Google News Philippines",
    category: "aggregator",
    hosts: [],
    feeds: [
      rss("https://news.google.com/rss?hl=en-PH&gl=PH&ceid=PH:en"),
      rss("https://news.google.com/rss/search?q=Pampanga+when:3d&hl=en-PH&gl=PH&ceid=PH:en"),
    ],
    readable: false,
  },
];

// Recognises an outlet from its name as written in the catalog or in a Google News listing.
const OUTLET_NAME_KEYS: [RegExp, string][] = [
  [/^gma\b/i, "gma"],
  [/abs-?cbn/i, "abs-cbn"],
  [/tv5|news5/i, "tv5"],
  [/bombo/i, "bombo"],
  [/inquirer/i, "inquirer"],
  [/philstar|philippine star/i, "philstar"],
  [/rappler/i, "rappler"],
  [/manila times/i, "manila-times"],
  [/manila bulletin|^mb\.com/i, "manila-bulletin"],
  [/businessworld|bworld/i, "bworld"],
  [/sunstar/i, "sunstar"],
  [/punto/i, "punto"],
  [/cltv/i, "cltv36"],
  [/pampanga ?news ?now/i, "pampanga-news-now"],
  [/philippine news agency|^pna\b/i, "pna"],
  [/google news/i, "google-news-ph"],
];

export function outletKeyForName(name: string): string | null {
  return OUTLET_NAME_KEYS.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

/** True when a headline comes from a hidden outlet, including through the Google News listing. */
export function isFromHiddenOutlet(item: { outletId: string; outletName: string }, hiddenIds: ReadonlySet<string>): boolean {
  if (hiddenIds.has(item.outletId)) return true;
  if (item.outletId !== GOOGLE_NEWS_OUTLET_ID) return false;
  const key = outletKeyForName(item.outletName);
  return key !== null && OUTLETS.some((outlet) => hiddenIds.has(outlet.id) && outletKeyForName(outlet.name) === key);
}

export function isGoogleNewsLink(url: string): boolean {
  try {
    return new URL(url).hostname === "news.google.com";
  } catch {
    return false;
  }
}

export function findOutletByUrl(url: string): Outlet | null {
  let host: string;
  let path: string;
  try {
    const parsed = new URL(url);
    host = parsed.hostname.replace(/^www\./, "");
    path = parsed.pathname;
  } catch {
    return null;
  }
  if (host === "sunstar.com.ph" && path.startsWith("/pampanga/")) {
    return OUTLETS.find((o) => o.id === "sunstar-pampanga") ?? null;
  }
  return OUTLETS.find((o) => o.hosts.some((h) => host === h || host.endsWith(`.${h}`))) ?? null;
}
