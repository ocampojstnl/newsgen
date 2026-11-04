import { NewsBrowser } from "@/components/news-browser";
import { requirePageUser } from "@/lib/api";
import { listStories } from "@/lib/stories";

export default async function HomePage() {
  const own = (await listStories(await requirePageUser())).filter((story) => story.is_owner);
  return <NewsBrowser storyCount={own.length} approvedCount={own.reduce((total, story) => total + story.approved_count, 0)} />;
}
