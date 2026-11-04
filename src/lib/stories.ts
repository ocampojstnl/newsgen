import { query } from "@/lib/db";
import type { ApprovedVersion, SessionUser, StoryListItem } from "@/lib/types";

/** The user's own stories and the stories shared with them. */
export function listStories(user: SessionUser): Promise<StoryListItem[]> {
  return query<StoryListItem>(
    `select s.id, s.title, s.created_at,
       (s.owner_id = $1) as is_owner,
       u.display_name as owner_name,
       coalesce(
         (select outlet_name from public.sources where story_id = s.id order by label limit 1),
         s.pending_sources -> 0 ->> 'outletName'
       ) as outlet_name,
       (select count(*)::int from public.sources where story_id = s.id) as source_count,
       (select count(*)::int from public.versions where story_id = s.id) as version_count,
       (select count(*)::int from public.versions where story_id = s.id and status = 'reviewed') as approved_count
     from public.stories s
     join public.users u on u.id = s.owner_id
     where s.owner_id = $1
        or exists (select 1 from public.story_shares sh where sh.story_id = s.id and sh.user_id = $1)
     order by s.created_at desc
     limit 200`,
    [user.id],
  );
}

export function listApprovedVersions(user: SessionUser): Promise<ApprovedVersion[]> {
  return query<ApprovedVersion>(
    `select v.id, v.story_id, s.title as story_title,
       (select outlet_name from public.sources where story_id = s.id order by label limit 1) as outlet_name,
       v.content -> 'headline' ->> 'text' as headline,
       v.label, v.language, v.word_count, v.byline, v.reviewed_at, v.share_token,
       (s.owner_id = $1) as is_owner,
       u.display_name as owner_name
     from public.versions v
     join public.stories s on s.id = v.story_id
     join public.users u on u.id = s.owner_id
     where v.status = 'reviewed'
       and (s.owner_id = $1
         or exists (select 1 from public.story_shares sh where sh.story_id = s.id and sh.user_id = $1))
     order by v.reviewed_at desc
     limit 200`,
    [user.id],
  );
}
