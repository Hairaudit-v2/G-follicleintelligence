-- FI guided assist: per-user Today home view counter for role-first tips window.
-- Uses fi_guided_assist_preferences (not a global profiles table) for multi-tenant RLS alignment.

alter table public.fi_guided_assist_preferences
  add column if not exists today_home_views integer not null default 0;

alter table public.fi_guided_assist_preferences
  drop constraint if exists fi_guided_assist_prefs_today_home_views_nonneg;

alter table public.fi_guided_assist_preferences
  add constraint fi_guided_assist_prefs_today_home_views_nonneg
  check (today_home_views >= 0);

comment on column public.fi_guided_assist_preferences.today_home_views is
  'Per-user count of Today (home) guided-assist role-first exposures. Tenant default rows (fi_user_id null) keep 0.';
