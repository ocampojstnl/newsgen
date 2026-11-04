import { PendingList } from "@/components/pending-list";
import { requirePageUser } from "@/lib/api";
import { listStories } from "@/lib/stories";

// Pending lists only the user's own stories, since only the owner can act on them.
export default async function PendingPage() {
  const stories = await listStories(await requirePageUser());
  return <PendingList stories={stories.filter((story) => story.is_owner)} />;
}
