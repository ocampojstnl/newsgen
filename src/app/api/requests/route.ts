import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, loadStory, loadVersion, requireUser, uuid } from "@/lib/api";
import { query } from "@/lib/db";
import { listIncomingRequests, listOutgoingRequests } from "@/lib/requests";

const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("edit"), storyId: uuid }),
  z.object({ kind: z.literal("publish"), versionId: uuid, mode: z.enum(["article", "article_with_original"]) }),
]);

export async function GET() {
  try {
    const user = await requireUser();
    const [incoming, outgoing] = await Promise.all([listIncomingRequests(user), listOutgoingRequests(user)]);
    return NextResponse.json({ incoming, outgoing });
  } catch (error) {
    return errorResponse(error);
  }
}

/** A viewer asks the owner for edit access, or the owner or an editor asks an admin to publish a version. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = body.parse(await request.json());

    if (input.kind === "edit") {
      const story = await loadStory(input.storyId, user, "view");
      if (story.access !== "view") throw new ApiError(400, "You can already edit this story.");
      // Admins can read every story, but only people it is shared with can ask to edit it.
      if (!(await isSharedWith(story.id, user.id))) throw new ApiError(400, "Only people this story is shared with can ask to edit it.");
      await query(
        `insert into public.access_requests (kind, story_id, requester_id) values ('edit', $1, $2) on conflict do nothing`,
        [story.id, user.id],
      );
      return NextResponse.json({ ok: true });
    }

    const version = await loadVersion(input.versionId, user, "edit");
    if (version.status !== "reviewed") throw new ApiError(422, "Approve this version before asking to publish it.");
    if (version.share_token) throw new ApiError(400, "This version already has a public link.");
    await query(
      `insert into public.access_requests (kind, story_id, version_id, requester_id, public_mode)
       values ('publish', $1, $2, $3, $4) on conflict do nothing`,
      [version.story_id, version.id, user.id, input.mode],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

async function isSharedWith(storyId: string, userId: string): Promise<boolean> {
  const rows = await query("select 1 from public.story_shares where story_id = $1 and user_id = $2", [storyId, userId]);
  return rows.length > 0;
}
