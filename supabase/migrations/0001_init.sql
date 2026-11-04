-- NewsGen schema. Every row belongs to one reporter and is protected by RLS.
-- Public access happens only through get_shared_version(), which returns
-- reviewed versions and short evidence quotes, never full captured articles.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  facts jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  pending_sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null,
  user_id uuid not null default auth.uid(),
  label text not null,
  outlet_id text,
  outlet_name text not null,
  url text not null,
  title text not null,
  author text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  capture_method text not null check (capture_method in ('page', 'pasted')),
  paragraphs jsonb not null,
  content_sha256 text not null,
  unique (story_id, label),
  foreign key (story_id, user_id) references public.stories (id, user_id) on delete cascade
);

create table public.versions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null,
  user_id uuid not null default auth.uid(),
  label text not null,
  target_words integer not null check (target_words between 50 and 3000),
  tone text not null,
  language text not null,
  content jsonb not null,
  word_count integer not null,
  status text not null default 'needs_review' check (status in ('needs_review', 'reviewed')),
  byline text,
  reviewed_at timestamptz,
  share_token text unique,
  created_at timestamptz not null default now(),
  foreign key (story_id, user_id) references public.stories (id, user_id) on delete cascade
);

create index sources_story_idx on public.sources (story_id);
create index versions_story_idx on public.versions (story_id);
create index stories_user_idx on public.stories (user_id, created_at desc);

-- Each story can hold at most five versions.
create function public.enforce_version_limit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.stories where id = new.story_id for update;
  if (select count(*) from public.versions where story_id = new.story_id) >= 5 then
    raise exception 'A story can have at most 5 versions' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger versions_limit before insert on public.versions
  for each row execute function public.enforce_version_limit();

alter table public.stories enable row level security;
alter table public.sources enable row level security;
alter table public.versions enable row level security;

create policy stories_owner on public.stories for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Captured sources are evidence, so there is no update or delete policy.
-- They are removed only when their story is deleted.
create policy sources_select on public.sources for select to authenticated
  using (user_id = (select auth.uid()));
create policy sources_insert on public.sources for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy versions_owner on public.versions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.stories, public.sources, public.versions from anon;

create function public.get_shared_version(p_token text) returns jsonb
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
        'content_sha256', s.content_sha256
      ) order by s.label), '[]'::jsonb)
      from public.sources s
      where s.story_id = v.story_id
    )
  )
  from public.versions v
  where v.share_token = p_token
    and v.status = 'reviewed';
$$;

revoke all on function public.get_shared_version(text) from public;
grant execute on function public.get_shared_version(text) to anon, authenticated;
revoke all on function public.enforce_version_limit() from public, anon, authenticated;
