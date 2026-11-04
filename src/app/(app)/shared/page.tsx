import { StoriesGrid } from "@/components/stories-grid";
import { requirePageUser } from "@/lib/api";
import { listStories } from "@/lib/stories";

export default async function SharedPage() {
  const stories = await listStories(await requirePageUser());
  return (
    <StoriesGrid
      stories={stories.filter((story) => !story.is_owner)}
      title="Shared with me"
      description="Stories other reporters shared with you. You see their changes live, and only the owner can edit."
      emptyTitle="Nothing shared with you yet"
      emptyText="When someone shares a story with you, it appears here."
    />
  );
}
