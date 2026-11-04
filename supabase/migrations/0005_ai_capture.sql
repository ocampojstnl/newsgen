-- Text retrieved by Gemini is the AI's copy of a page, so it is labelled separately from a direct capture.
alter table public.sources drop constraint sources_capture_method_check;
alter table public.sources
  add constraint sources_capture_method_check check (capture_method in ('page', 'pasted', 'browser', 'ai'));
