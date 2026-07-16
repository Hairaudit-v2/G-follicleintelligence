-- Clinic guide: document rollout checklist + health filter metadata keys (no schema break).
-- Status JSON lives on tenant default row: fi_guided_assist_preferences.metadata
--   guided_assist_rollout_status: { completed: { itemId: iso }, completedAtIso, updatedAtIso }
-- Event detail may include todayRole / experienceLevel for Guide Health role filters.

comment on column public.fi_guided_assist_preferences.metadata is
  'JSON bag: whats_new_seen_version (per-user), guided_assist_rollout_status (tenant default row only). Operational UX only.';

comment on column public.fi_guided_assist_events.detail is
  'Optional todayRole, experienceLevel, operationalOnly flags for admin Guide Health filters.';
