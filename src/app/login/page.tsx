import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/api";
import { loadAllFeeds } from "@/lib/feeds";

const TAPE_WAIT_MS = 2500;

/** Latest headlines for the tape. Sign-in must never wait on news sites, so this gives up quickly. */
async function loadTape() {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TAPE_WAIT_MS));
  const feeds = await Promise.race([loadAllFeeds().catch(() => null), timeout]);
  return (feeds?.items ?? []).slice(0, 14).map((item) => ({ outlet: item.outletName, title: item.title }));
}

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <LoginForm tape={await loadTape()} />;
}
