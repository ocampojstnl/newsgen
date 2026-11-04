import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, loadStory, loadVersion, requireUser, updateVersion, uuid } from "@/lib/api";
import { query } from "@/lib/db";

const body = z.object({
  enabled: z.boolean(),
  mode: z.enum(["article", "article_with_original"]).optional(),
});

/** Only an admin can make a version public. The owner or an admin can take it down again. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const { enabled, mode } = body.parse(await request.json());
    const version = await loadVersion(id, user, "view");

    if (!enabled) {
      const story = await loadStory(version.story_id, user, "view");
      if (story.access !== "own" && user.role !== "admin") throw new ApiError(403, "Only the owner or an admin can turn off a public link.");
      return NextResponse.json({ version: await updateVersion(id, { share_token: null, public_mode: null }) });
    }

    if (user.role !== "admin") throw new ApiError(403, "Only an admin can publish a link. Send a request instead.");
    if (version.status !== "reviewed") throw new ApiError(422, "Approve this version before creating a link.");
    const updated = await updateVersion(id, {
      share_token: version.share_token ?? randomBytes(24).toString("base64url"),
      public_mode: mode ?? "article",
    });
    await query(
      `update public.access_requests set status = 'approved', decided_by = $2, decided_at = now()
       where kind = 'publish' and version_id = $1 and status = 'pending'`,
      [id, user.id],
    );
    return NextResponse.json({ version: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
