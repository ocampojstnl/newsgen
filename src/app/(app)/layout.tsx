import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/api";
import { countIncomingRequests } from "@/lib/requests";
import { listStories } from "@/lib/stories";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const [stories, requestCount, cookieStore] = await Promise.all([listStories(user), countIncomingRequests(user), cookies()]);
  return (
    <AppShell user={user} stories={stories} requestCount={requestCount} initialCollapsed={cookieStore.get("newsgen_sidebar")?.value === "1"}>
      {children}
    </AppShell>
  );
}
