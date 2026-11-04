-- Named accounts replace the single shared password. Each story has one owner who edits it,
-- and the owner can share it with other users, who see it read-only and update live.

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  display_name text not null check (length(display_name) between 1 and 80),
  password_hash text not null,
  role text not null default 'reporter' check (role in ('admin', 'reporter')),
  disabled boolean not null default false,
  -- Raised on password change or disable, which ends every existing session of that user.
  session_version integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.stories add column owner_id uuid references public.users (id) on delete restrict;
alter table public.stories add column updated_at timestamptz not null default now();
create index stories_owner_idx on public.stories (owner_id, created_at desc);

create table public.story_shares (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
create index story_shares_user_idx on public.story_shares (user_id);

-- Any change to a story, its sources or its versions moves updated_at, which viewers poll.
create function public.touch_story() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.stories set updated_at = now()
  where id = coalesce(new.story_id, old.story_id);
  return null;
end;
$$;

create function public.touch_story_self() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stories_touch before update on public.stories
  for each row execute function public.touch_story_self();
create trigger versions_touch after insert or update or delete on public.versions
  for each row execute function public.touch_story();
create trigger sources_touch after insert or delete on public.sources
  for each row execute function public.touch_story();
create trigger shares_touch after insert or delete on public.story_shares
  for each row execute function public.touch_story();

alter table public.users enable row level security;
alter table public.story_shares enable row level security;
revoke all on public.users, public.story_shares from anon, authenticated;
revoke all on function public.touch_story(), public.touch_story_self() from public, anon, authenticated;
