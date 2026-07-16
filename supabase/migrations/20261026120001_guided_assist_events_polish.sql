-- Clinic guide monitoring event kinds for polish release (quick actions, tour steps, feedback aggregate).

alter table public.fi_guided_assist_events
  drop constraint if exists fi_guided_assist_events_kind_chk;

alter table public.fi_guided_assist_events
  add constraint fi_guided_assist_events_kind_chk check (
    event_kind in (
      'assist_enabled',
      'assist_disabled',
      'tip_shown',
      'tip_dismissed',
      'tip_snoozed',
      'next_action_clicked',
      'widget_collapsed',
      'widget_expanded',
      'tip_feedback_helpful',
      'tip_feedback_unhelpful',
      'engagement_active',
      'tour_completed',
      'tour_step_completed',
      'quick_action_clicked',
      'feedback_submitted',
      'streak_advanced',
      'whats_new_dismissed'
    )
  );

comment on constraint fi_guided_assist_events_kind_chk on public.fi_guided_assist_events is
  'Clinic guide telemetry kinds (operational UX only). tip_shown ≈ tip_viewed.';

-- Lightweight tenant-scoped analytics view (service role / admins via app server).
-- Filters must always include tenant_id in queries (RLS still applies on base tables when used as invoker).
create or replace view public.fi_guided_assist_health_events_v
with (security_invoker = true)
as
select
  e.tenant_id,
  e.event_kind,
  e.guidance_code,
  e.guidance_area,
  e.page_key,
  e.fi_user_id,
  e.occurred_at,
  e.detail
from public.fi_guided_assist_events e
where e.event_kind in (
  'tip_shown',
  'tip_feedback_helpful',
  'tip_feedback_unhelpful',
  'feedback_submitted',
  'quick_action_clicked',
  'tour_step_completed',
  'tour_completed',
  'streak_advanced',
  'next_action_clicked',
  'engagement_active',
  'whats_new_dismissed'
);

comment on view public.fi_guided_assist_health_events_v is
  'Clinic guide health events subset for admin analytics (tenant-scoped operational UX only).';
