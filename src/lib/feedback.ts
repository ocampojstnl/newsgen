import { ApiError } from "@/lib/api";
import { query } from "@/lib/db";
import type { FeedbackComment, FeedbackItem } from "@/lib/feedback-meta";
import type { SessionUser } from "@/lib/types";

const SELECT = `select f.id, f.number, f.kind, f.title, f.description, f.page, f.status, f.priority, f.developer_note,
    f.reporter_id, u.display_name as reporter_name, f.created_at, f.updated_at,
    (select count(*)::int from public.feedback_votes v where v.feedback_id = f.id) as votes,
    exists (select 1 from public.feedback_votes v where v.feedback_id = f.id and v.user_id = $1) as voted,
    (select count(*)::int from public.feedback_comments c where c.feedback_id = f.id and c.status_change is null) as comment_count
  from public.feedback f
  join public.users u on u.id = f.reporter_id`;

export function listFeedback(user: SessionUser): Promise<FeedbackItem[]> {
  return query<FeedbackItem>(`${SELECT} order by f.updated_at desc limit 500`, [user.id]);
}

export async function loadFeedback(number: number, user: SessionUser): Promise<FeedbackItem> {
  const [item] = await query<FeedbackItem>(`${SELECT} where f.number = $2`, [user.id, number]);
  if (!item) throw new ApiError(404, "Task not found.");
  return item;
}

export function loadFeedbackComments(feedbackId: string): Promise<FeedbackComment[]> {
  return query<FeedbackComment>(
    `select c.id, c.author_id, u.display_name as author_name, (u.role = 'admin') as author_is_admin,
       c.body, c.status_change, c.created_at
     from public.feedback_comments c
     join public.users u on u.id = c.author_id
     where c.feedback_id = $1
     order by c.created_at`,
    [feedbackId],
  );
}

export async function countOpenFeedback(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from public.feedback where status = 'new'");
  return row.n;
}
