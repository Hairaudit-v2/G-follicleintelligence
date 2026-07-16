-- Optional free-text comment on Clinic guide tip feedback (operational only).

alter table public.fi_guided_assist_feedback
  add column if not exists comment text null;

alter table public.fi_guided_assist_feedback
  drop constraint if exists fi_guided_assist_feedback_comment_len_chk;

alter table public.fi_guided_assist_feedback
  add constraint fi_guided_assist_feedback_comment_len_chk
  check (comment is null or char_length(comment) <= 500);

comment on column public.fi_guided_assist_feedback.comment is
  'Optional short note from staff (why a tip was/was not helpful). Operational UX feedback only.';
