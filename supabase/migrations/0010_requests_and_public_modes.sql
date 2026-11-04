-- Shared users can be viewers or editors. Public links need an admin, who also chooses
-- whether the original article is published next to the version.

alter table public.story_shares
  add column role text not null default 'viewer' check (role in ('viewer', 'editor'));

alter table public.versions
  add column public_mode text check (public_mode in ('article', 'article_with_original'));
update public.versions set public_mode = 'article' where share_token is not null;

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('edit', 'publish')),
  story_id uuid not null references public.stories (id) on delete cascade,
  version_id uuid references public.versions (id) on delete cascade,
  requester_id uuid not null references public.users (id) on delete cascade,
  public_mode text check (public_mode in ('article', 'article_with_original')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references public.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'publish') = (version_id is not null and public_mode is not null))
);

-- One open request of each kind per person and target.
create unique index access_requests_one_pending on public.access_requests
  (kind, story_id, coalesce(version_id, '00000000-0000-0000-0000-000000000000'::uuid), requester_id)
  where status = 'pending';
create index access_requests_story_idx on public.access_requests (story_id);

create trigger requests_touch after insert or update or delete on public.access_requests
  for each row execute function public.touch_story();

alter table public.access_requests enable row level security;
revoke all on public.access_requests from anon, authenticated;

-- Public links return the original article only when an admin chose to publish it.
create or replace function public.get_shared_version(p_token text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', v.id,
    'label', v.label,
    'language', v.language,
    'tone', v.tone,
    'content', v.content,
    'word_count', v.word_count,
    'byline', v.byline,
    'reviewed_at', v.reviewed_at,
    'public_mode', coalesce(v.public_mode, 'article'),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'label', s.label,
        'outlet_name', s.outlet_name,
        'url', s.url,
        'title', s.title,
        'author', s.author,
        'published_at', s.published_at,
        'fetched_at', s.fetched_at,
        'capture_method', s.capture_method,
        'content_sha256', s.content_sha256,
        'paragraphs', case when v.public_mode = 'article_with_original' then s.paragraphs else null end
      ) order by s.label), '[]'::jsonb)
      from public.sources s
      where s.story_id = v.story_id
    )
  )
  from public.versions v
  where v.share_token = p_token
    and v.status = 'reviewed';
$$;

revoke all on function public.get_shared_version(text) from public, anon, authenticated;
