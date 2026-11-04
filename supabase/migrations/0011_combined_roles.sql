-- An account can be a reporter, an admin, or both. users.role still decides admin rights;
-- is_reporter marks the people who write stories.
alter table public.users add column is_reporter boolean not null default true;
-- The bootstrap admin account is an administrator only.
update public.users set is_reporter = false where username = 'admin';
alter table public.users add constraint users_has_a_role check (is_reporter or role = 'admin');
