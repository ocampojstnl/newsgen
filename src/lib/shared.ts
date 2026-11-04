import { query } from "@/lib/db";
import { cleanText } from "@/lib/text";
import type { SharedVersion } from "@/lib/types";

/** Returns only reviewed versions and leaves out full article text and reporter-only review data. */
export async function loadSharedVersion(token: string): Promise<SharedVersion | null> {
  const [row] = await query<{ shared: SharedVersion | null }>("select public.get_shared_version($1) as shared", [token]);
  const shared = row?.shared ?? null;
  return shared && { ...shared, sources: shared.sources.map((source) => ({ ...source, title: cleanText(source.title) })) };
}
