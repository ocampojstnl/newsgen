-- Internal tool with one shared password. The Next.js server is the only database client.
-- RLS stays on with no policies, so Supabase's public API cannot read or change these tables.

drop policy stories_owner on public.stories;
drop policy sources_select on public.sources;
drop policy sources_insert on public.sources;
drop policy versions_owner on public.versions;

alter table public.sources drop constraint sources_story_id_user_id_fkey;
alter table public.versions drop constraint versions_story_id_user_id_fkey;
alter table public.stories drop constraint stories_id_user_id_key;

alter table public.sources drop column user_id;
alter table public.versions drop column user_id;
alter table public.stories drop column user_id;

alter table public.sources
  add constraint sources_story_id_fkey foreign key (story_id) references public.stories (id) on delete cascade;
alter table public.versions
  add constraint versions_story_id_fkey foreign key (story_id) references public.stories (id) on delete cascade;

create index stories_created_idx on public.stories (created_at desc);

revoke all on public.stories, public.sources, public.versions from anon, authenticated;
revoke execute on function public.get_shared_version(text) from anon, authenticated;

-- Captured sources are evidence. They can be added, and removed with their story, but never altered.
create function public.block_source_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Captured sources cannot be changed' using errcode = 'P0001';
end;
$$;

create trigger sources_immutable before update on public.sources
  for each row execute function public.block_source_update();

revoke all on function public.block_source_update() from public, anon, authenticated;
