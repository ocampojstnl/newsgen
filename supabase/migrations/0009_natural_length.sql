-- A version can have no word target: the writer uses the length the facts naturally need.
alter table public.versions alter column target_words drop not null;
