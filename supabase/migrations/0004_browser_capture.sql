-- Articles brought in from the reporter's own browser get their own label.
alter table public.sources drop constraint sources_capture_method_check;
alter table public.sources
  add constraint sources_capture_method_check check (capture_method in ('page', 'pasted', 'browser'));
