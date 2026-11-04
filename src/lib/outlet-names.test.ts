import { describe, expect, it } from "vitest";
import { findOutletNames } from "@/lib/outlet-names";

describe("findOutletNames", () => {
  it.each([
    ["Iniulat ng CLTV36 na nailigtas ang kambal.", "CLTV36"],
    ["According to GMA News, two minors drowned.", "GMA"],
    ["Sa panayam ng Bombo Radyo, sinabi ni Montesa.", "Bombo Radyo"],
    ["ABS-CBN reported the fire.", "ABS-CBN"],
    ["Philstar.com said the hearing ended.", "Philstar"],
    ["The Philippine News Agency reported it.", "PNA"],
  ])("finds the outlet in %s", (text, name) => {
    expect(findOutletNames(text)).toEqual([name]);
  });

  it("finds several outlets in one sentence", () => {
    expect(findOutletNames("GMA News and Philstar reported the ruling.")).toEqual(["GMA", "Philstar"]);
  });

  it("does not confuse ordinary words or agencies with outlets", () => {
    expect(findOutletNames("Ayon sa PNP at sa mga ulat, ang punto ng imbestigasyon ay malinaw.")).toEqual([]);
    expect(findOutletNames("The DPWH and the Inquiry committee met with the gmail team.")).toEqual([]);
  });

  it("ignores names inside direct quotations", () => {
    expect(findOutletNames('Santos said, "I told GMA News everything," at the capitol.')).toEqual([]);
  });

  it("finds a name outside a quotation in the same sentence", () => {
    expect(findOutletNames('"We will repair them," Santos told Rappler.')).toEqual(["Rappler"]);
  });
});
