import { NextResponse } from "next/server";
import { errorResponse, loadSources, loadStory, loadVersions, requireUser, uuid } from "@/lib/api";
import { query } from "@/lib/db";

/** The full story, for viewers and other tabs that pick up live changes. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const story = await loadStory(id, user, "view");
    const [sources, versions] = await Promise.all([loadSources(id), loadVersions(id)]);
    return NextResponse.json({ story, sources, versions }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    await loadStory(id, user, "own");
    await query("delete from public.stories where id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
