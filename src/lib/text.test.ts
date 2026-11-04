import { describe, expect, it } from "vitest";
import { cleanText, decodeEntities } from "@/lib/text";

describe("decodeEntities", () => {
  it("decodes a trailing &nbsp; like the Sara Duterte headline", () => {
    expect(cleanText("Sara Duterte's defense team lists law professor as its first witness&nbsp;")).toBe(
      "Sara Duterte's defense team lists law professor as its first witness",
    );
  });

  it("decodes double-encoded codes", () => {
    expect(cleanText("A&amp;nbsp;B")).toBe("A B");
  });

  it("decodes numeric and named codes", () => {
    expect(decodeEntities("It&#8217;s &#x20B1;30 &ndash; Pe&ntilde;a")).toBe("It’s ₱30 – Peña");
  });

  it("leaves unknown codes and plain ampersands alone", () => {
    expect(decodeEntities("AT&T &unknown; R&D")).toBe("AT&T &unknown; R&D");
  });
});
