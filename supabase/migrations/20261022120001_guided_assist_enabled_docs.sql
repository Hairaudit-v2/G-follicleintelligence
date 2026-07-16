-- Clinic guide (Guided Assist) user-controlled on/off.
-- Column already exists as assist_enabled (nullable boolean).
-- Null = inherit tenant defaults; true/false = explicit per-user preference.
-- No new column: product "enabled" maps to assist_enabled.

comment on column public.fi_guided_assist_preferences.assist_enabled is
  'Per-user Clinic guide on/off. True = force on; false = force off; null = inherit tenant defaults (onboarding vs post-setup). Tenant-isolated via tenant_id + fi_user_id.';

comment on column public.fi_guided_assist_preferences.default_assist_enabled is
  'Tenant default after clinic setup is complete (fi_user_id is null row only). Admins can set true so staff inherit the guide on.';

comment on column public.fi_guided_assist_preferences.default_enabled_during_onboarding is
  'Tenant default while clinic setup is incomplete (fi_user_id is null row only). Defaults true so new clinics see the guide.';
