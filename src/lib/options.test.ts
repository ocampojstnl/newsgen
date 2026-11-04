import { describe, expect, it } from "vitest";
import { detectLanguage } from "@/lib/options";

describe("detectLanguage", () => {
  it("recognises Filipino text", () => {
    expect(detectLanguage(["Nauwi sa trahedya ang pagligo ng dalawang babaeng menor de edad sa Iponan River."])).toBe("Filipino");
  });

  it("recognises English text", () => {
    expect(detectLanguage(["The court said on Monday that the trial of the former president was set for November."])).toBe("English");
  });

  it("keeps English for Philippine place names and Taglish words in English copy", () => {
    expect(detectLanguage(["The barangay captain of Pagatpat said that the rescue was in the river at noon."])).toBe("English");
  });

  it("defaults to English when there is no text", () => {
    expect(detectLanguage([])).toBe("English");
  });
});
