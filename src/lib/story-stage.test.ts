import { describe, expect, it } from "vitest";
import { pendingStage } from "@/lib/story-stage";
import type { StoryListItem } from "@/lib/types";

const story = (source_count: number, version_count: number, approved_count: number): StoryListItem => ({
  id: "x",
  title: "t",
  created_at: "2026-11-03T00:00:00Z",
  is_owner: true,
  owner_name: "Owner",
  outlet_name: null,
  source_count,
  version_count,
  approved_count,
});

describe("pendingStage", () => {
  it("needs an article when there are no sources", () => {
    expect(pendingStage(story(0, 0, 0))).toBe("article");
  });

  it("is ready to write when it has sources but no versions", () => {
    expect(pendingStage(story(1, 0, 0))).toBe("write");
  });

  it("is in review when a version is waiting", () => {
    expect(pendingStage(story(1, 2, 0))).toBe("review");
  });

  it("stays in review when only some versions are approved", () => {
    expect(pendingStage(story(1, 3, 1))).toBe("review");
  });

  it("is not pending when every version is approved", () => {
    expect(pendingStage(story(1, 2, 2))).toBeNull();
  });
});
