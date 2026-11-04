import type { StoryListItem } from "@/lib/types";

export type PendingStage = "review" | "article" | "write";

/** What a story still needs. A story with one approved version can still have others waiting for review. */
export function pendingStage(story: StoryListItem): PendingStage | null {
  if (story.source_count === 0) return "article";
  if (story.version_count === 0) return "write";
  return story.version_count > story.approved_count ? "review" : null;
}
