import { query } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export type AccessRequest = {
  id: string;
  kind: "edit" | "publish";
  story_id: string;
  story_title: string;
  version_id: string | null;
  version_label: string | null;
  version_status: "needs_review" | "reviewed" | null;
  public_mode: "article" | "article_with_original" | null;
  requester_id: string;
  requester_name: string;
  owner_name: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
  decided_at: string | null;
};

const SELECT = `select r.id, r.kind, r.story_id, s.title as story_title, r.version_id, v.label as version_label,
    v.status as version_status, r.public_mode, r.requester_id, ru.display_name as requester_name,
    ou.display_name as owner_name, r.status, r.created_at, r.decided_at
  from public.access_requests r
  join public.stories s on s.id = r.story_id
  join public.users ru on ru.id = r.requester_id
  join public.users ou on ou.id = s.owner_id
  left join public.versions v on v.id = r.version_id`;

/** Requests waiting for this user: edit requests on stories they own, and, for admins, every publish request. */
export function listIncomingRequests(user: SessionUser) {
  return query<AccessRequest>(
    `${SELECT}
     where r.status = 'pending'
       and ((r.kind = 'edit' and s.owner_id = $1) or (r.kind = 'publish' and $2))
     order by r.created_at`,
    [user.id, user.role === "admin"],
  );
}

/** What this user asked for recently, so they can see the answer. */
export function listOutgoingRequests(user: SessionUser) {
  return query<AccessRequest>(`${SELECT} where r.requester_id = $1 order by r.created_at desc limit 30`, [user.id]);
}

export async function countIncomingRequests(user: SessionUser): Promise<number> {
  const [row] = await query<{ n: number }>(
    `select count(*)::int as n from public.access_requests r join public.stories s on s.id = r.story_id
     where r.status = 'pending' and ((r.kind = 'edit' and s.owner_id = $1) or (r.kind = 'publish' and $2))`,
    [user.id, user.role === "admin"],
  );
  return row.n;
}
