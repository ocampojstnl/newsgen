import { describe, expect, it } from "vitest";
import { parsePnaHome } from "@/lib/feeds";

describe("parsePnaHome", () => {
  const html = `
    <a href="/article/aid-for-ofws" class="relative z-10" aria-label="Aid for OFWs &amp; families"><p>Aid</p></a>
    <div class="flex"><p>Oct 30, 2026 · 2:56 PM</p><p></p></div>
    <a href="/article/aid-for-ofws" aria-label="Aid for OFWs &amp; families"></a>
    <a href="/article/no-date" aria-label="No date here"></a>
    <a href="/about" aria-label="About"></a>`;

  it("lists each article once, with its title and full link", () => {
    const items = parsePnaHome(html);
    expect(items.map((i) => i.url)).toEqual(["https://www.pna.gov.ph/article/aid-for-ofws", "https://www.pna.gov.ph/article/no-date"]);
    expect(items[0].title).toBe("Aid for OFWs & families");
  });

  it("reads the listed time as Philippine time", () => {
    const [item] = parsePnaHome(html);
    expect(new Date(item.publishedAt!).toISOString()).toBe("2026-10-30T06:56:00.000Z");
  });

  it("returns nothing for a page with no articles", () => {
    expect(parsePnaHome("<html></html>")).toEqual([]);
  });
});
