import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/api";
import { countOpenFeedback } from "@/lib/feedback";
import { countIncomingRequests } from "@/lib/requests";
import { listStories } from "@/lib/stories";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const [stories, requestCount, newFeedback, cookieStore] = await Promise.all([
    listStories(user),
    countIncomingRequests(user),
    // Admins triage feedback, so they see how many reports are waiting.
    user.role === "admin" ? countOpenFeedback() : Promise.resolve(0),
    cookies(),
  ]);
  return (
    <AppShell user={user} stories={stories} requestCount={requestCount} feedbackCount={newFeedback} initialCollapsed={cookieStore.get("newsgen_sidebar")?.value === "1"}>
      {children}
    </AppShell>
  );
}
