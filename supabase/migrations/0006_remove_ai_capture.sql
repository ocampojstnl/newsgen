-- The AI article reader was removed. No source ever used this label.
alter table public.sources drop constraint sources_capture_method_check;
alter table public.sources
  add constraint sources_capture_method_check check (capture_method in ('page', 'pasted', 'browser'));
