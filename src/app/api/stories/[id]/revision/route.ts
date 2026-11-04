import { NextResponse } from "next/server";
import { errorResponse, loadStory, requireUser, uuid } from "@/lib/api";

/** A cheap check that open pages poll. Its value changes whenever the story, its sources or versions change. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const story = await loadStory(uuid.parse((await params).id), user, "view");
    return NextResponse.json({ updatedAt: story.updated_at }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
