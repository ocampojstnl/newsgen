import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, loadStory, requireUser, uuid } from "@/lib/api";
import { query } from "@/lib/db";

const role = z.enum(["viewer", "editor"]);
const body = z.object({ shares: z.array(z.object({ userId: uuid, role })).max(200) });

type ShareRow = { user_id: string; role: "viewer" | "editor" };

function listShares(storyId: string) {
  return query<ShareRow>("select user_id, role from public.story_shares where story_id = $1", [storyId]);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    await loadStory(id, user, "own");
    return NextResponse.json({ shares: await listShares(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Replaces who the story is shared with, and whether each person can view or edit. Only the owner can change it. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const { shares } = body.parse(await request.json());
    await loadStory(id, user, "own");
    const wanted = new Map(shares.filter((share) => share.userId !== user.id).map((share) => [share.userId, share.role]));
    const ids = [...wanted.keys()];
    await query("delete from public.story_shares where story_id = $1 and not (user_id = any($2::uuid[]))", [id, ids]);
    // Only active accounts can be added, so a disabled account is ignored.
    await query(
      `insert into public.story_shares (story_id, user_id, role)
       select $1, u.id, x.role
       from public.users u
       join unnest($2::uuid[], $3::text[]) as x(user_id, role) on x.user_id = u.id
       where not u.disabled
       on conflict (story_id, user_id) do update set role = excluded.role`,
      [id, ids, ids.map((userId) => wanted.get(userId))],
    );
    // A pending edit request is settled by the owner's choice here.
    await query(
      `update public.access_requests set status = case when s.role = 'editor' then 'approved' else status end,
         decided_by = $2, decided_at = now()
       from public.story_shares s
       where access_requests.kind = 'edit' and access_requests.status = 'pending' and access_requests.story_id = $1
         and s.story_id = $1 and s.user_id = access_requests.requester_id and s.role = 'editor'`,
      [id, user.id],
    );
    return NextResponse.json({ shares: await listShares(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
