import { describe, expect, it } from "vitest";
import { isFromHiddenOutlet } from "@/lib/catalog";
import { parseHiddenOutlets } from "@/lib/hidden-outlets";

describe("parseHiddenOutlets", () => {
  it("reads saved outlet ids", () => {
    expect([...parseHiddenOutlets('["abs-cbn","tv5"]')]).toEqual(["abs-cbn", "tv5"]);
  });

  it.each(["not json", "{}", "null", ""])("treats %s as nothing hidden", (raw) => {
    expect(parseHiddenOutlets(raw).size).toBe(0);
  });

  it("ignores values that are not ids", () => {
    expect([...parseHiddenOutlets('["gma", 3, null]')]).toEqual(["gma"]);
  });
});

describe("isFromHiddenOutlet", () => {
  const hidden = new Set(["abs-cbn"]);

  it("hides the outlet's own headlines", () => {
    expect(isFromHiddenOutlet({ outletId: "abs-cbn", outletName: "ABS-CBN News" }, hidden)).toBe(true);
  });

  it("hides the same outlet when it comes through Google News", () => {
    expect(isFromHiddenOutlet({ outletId: "google-news-ph", outletName: "ABS-CBN" }, hidden)).toBe(true);
  });

  it("keeps other outlets", () => {
    expect(isFromHiddenOutlet({ outletId: "gma", outletName: "GMA News" }, hidden)).toBe(false);
    expect(isFromHiddenOutlet({ outletId: "google-news-ph", outletName: "GMA Network" }, hidden)).toBe(false);
    expect(isFromHiddenOutlet({ outletId: "google-news-ph", outletName: "Cebu Daily News" }, hidden)).toBe(false);
  });

  it("hides everything in Google News only when that listing itself is hidden", () => {
    expect(isFromHiddenOutlet({ outletId: "google-news-ph", outletName: "Cebu Daily News" }, new Set(["google-news-ph"]))).toBe(true);
  });
});
