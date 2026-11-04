import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const USER_AGENT = "NewsGen/1.0 (reporter research tool; fetches single articles on request)";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export class FetchRefusedError extends Error {}

export function isPrivateAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const ip = mapped ? mapped[1] : address.toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  return (
    ip === "::" ||
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe8") ||
    ip.startsWith("fe9") ||
    ip.startsWith("fea") ||
    ip.startsWith("feb") ||
    ip.startsWith("ff")
  );
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchRefusedError("That is not a valid link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FetchRefusedError("Only http and https links can be read.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new FetchRefusedError("Only standard web ports can be read.");
  }
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true }).catch(() => {
    throw new FetchRefusedError("That website could not be found.");
  });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new FetchRefusedError("That address is not a public website.");
  }
  return url;
}

/** Fetches a public page, re-validating every redirect so a link cannot reach internal hosts. */
export async function safeFetchText(
  raw: string,
  timeoutMs = 20_000,
): Promise<{ text: string; finalUrl: string }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new FetchRefusedError("The website sent an invalid redirect.");
      current = new URL(location, url).toString();
      continue;
    }
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      throw new FetchRefusedError(`The website refused automated reading (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      throw new FetchRefusedError(`The website returned HTTP ${response.status}.`);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) throw new FetchRefusedError("That page is too large to read.");
    return { text: new TextDecoder().decode(buffer), finalUrl: url.toString() };
  }
  throw new FetchRefusedError("The link redirected too many times.");
}
