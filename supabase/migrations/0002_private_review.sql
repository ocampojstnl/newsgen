-- Reporter-only review data (legal flags, verification notes, proofreading log).
-- get_shared_version() selects named columns and does not return this one.
alter table public.versions add column review jsonb not null default '{}'::jsonb;
