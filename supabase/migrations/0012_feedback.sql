-- Bug reports and feature requests, tracked as numbered tasks (NG-1, NG-2, ...).
-- Anyone signed in can file and comment. Admins triage: status, priority and a reply.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  number integer generated always as identity unique,
  kind text not null check (kind in ('bug', 'feature')),
  title text not null check (length(title) between 3 and 140),
  description text not null check (length(description) between 1 and 5000),
  page text check (length(page) <= 300),
  status text not null default 'new'
    check (status in ('new', 'accepted', 'in_progress', 'done', 'not_doable', 'duplicate')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  reporter_id uuid not null references public.users (id) on delete cascade,
  developer_note text check (length(developer_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feedback_votes (
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  primary key (feedback_id, user_id)
);

create table public.feedback_comments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  body text not null check (length(body) between 1 and 3000),
  -- Status changes are logged as comments, so the task keeps its history.
  status_change text,
  created_at timestamptz not null default now()
);

create index feedback_status_idx on public.feedback (status, updated_at desc);
create index feedback_comments_idx on public.feedback_comments (feedback_id, created_at);

create trigger feedback_touch before update on public.feedback
  for each row execute function public.touch_story_self();

alter table public.feedback enable row level security;
alter table public.feedback_votes enable row level security;
alter table public.feedback_comments enable row level security;
revoke all on public.feedback, public.feedback_votes, public.feedback_comments from anon, authenticated;
