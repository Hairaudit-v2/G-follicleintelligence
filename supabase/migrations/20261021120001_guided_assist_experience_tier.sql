-- Clinic guide experience tier (optional override) + guide start timestamp for age inference.

alter table public.fi_guided_assist_preferences
  add column if not exists experience_level text null;

alter table public.fi_guided_assist_preferences
  drop constraint if exists fi_guided_assist_prefs_experience_level_chk;

alter table public.fi_guided_assist_preferences
  add constraint fi_guided_assist_prefs_experience_level_chk
  check (
    experience_level is null
    or experience_level in ('novice', 'intermediate', 'advanced')
  );

comment on column public.fi_guided_assist_preferences.experience_level is
  'Optional per-user override for Clinic guide tip tier. Null = infer from today_home_views + created_at.';

-- created_at already exists on fi_guided_assist_preferences for account/guide age.
