import { StoriesGrid } from "@/components/stories-grid";
import { requirePageUser } from "@/lib/api";
import { listStories } from "@/lib/stories";

export default async function StoriesPage() {
  const stories = await listStories(await requirePageUser());
  return <StoriesGrid stories={stories.filter((story) => story.is_owner)} />;
}
