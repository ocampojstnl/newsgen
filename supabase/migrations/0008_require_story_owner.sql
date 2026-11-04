-- Run after scripts/create-user.mjs has created the first admin, which takes over existing stories.
alter table public.stories alter column owner_id set not null;
