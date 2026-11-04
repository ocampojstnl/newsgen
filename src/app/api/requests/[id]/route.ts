import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, requireUser, uuid } from "@/lib/api";
import { query } from "@/lib/db";

const body = z.object({ decision: z.enum(["approve", "decline"]) });

type RequestRow = {
  id: string;
  kind: "edit" | "publish";
  story_id: string;
  version_id: string | null;
  requester_id: string;
  public_mode: "article" | "article_with_original" | null;
  status: string;
  owner_id: string;
  version_status: string | null;
  share_token: string | null;
};

/** The story owner decides edit requests. An admin decides publish requests. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const { decision } = body.parse(await request.json());

    const [row] = await query<RequestRow>(
      `select r.id, r.kind, r.story_id, r.version_id, r.requester_id, r.public_mode, r.status, s.owner_id,
         v.status as version_status, v.share_token
       from public.access_requests r
       join public.stories s on s.id = r.story_id
       left join public.versions v on v.id = r.version_id
       where r.id = $1`,
      [id],
    );
    const allowed = row && (row.kind === "edit" ? row.owner_id === user.id : user.role === "admin");
    if (!row || !allowed) throw new ApiError(404, "Request not found.");
    if (row.status !== "pending") throw new ApiError(409, "This request was already answered.");

    if (decision === "approve" && row.kind === "edit") {
      await query(
        `insert into public.story_shares (story_id, user_id, role) values ($1, $2, 'editor')
         on conflict (story_id, user_id) do update set role = 'editor'`,
        [row.story_id, row.requester_id],
      );
    }
    if (decision === "approve" && row.kind === "publish") {
      if (row.version_status !== "reviewed") throw new ApiError(422, "That version is no longer approved, so it cannot be published.");
      await query("update public.versions set share_token = $2, public_mode = $3 where id = $1", [
        row.version_id,
        row.share_token ?? randomBytes(24).toString("base64url"),
        row.public_mode,
      ]);
    }
    await query("update public.access_requests set status = $2, decided_by = $3, decided_at = now() where id = $1", [
      id,
      decision === "approve" ? "approved" : "declined",
      user.id,
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
