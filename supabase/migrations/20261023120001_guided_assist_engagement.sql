-- Clinic guide engagement: tip helpfulness feedback + usage streak fields.
-- Strictly operational adoption metrics (no clinical content).

-- ---------------------------------------------------------------------------
-- Per-user engagement streak (preferences row for fi_user_id not null)
-- ---------------------------------------------------------------------------
alter table public.fi_guided_assist_preferences
  add column if not exists engagement_streak_days integer not null default 0;

alter table public.fi_guided_assist_preferences
  add column if not exists engagement_last_active_date date null;

alter table public.fi_guided_assist_preferences
  drop constraint if exists fi_guided_assist_prefs_streak_chk;

alter table public.fi_guided_assist_preferences
  add constraint fi_guided_assist_prefs_streak_chk
  check (engagement_streak_days >= 0 and engagement_streak_days <= 3650);

comment on column public.fi_guided_assist_preferences.engagement_streak_days is
  'Consecutive calendar days the user engaged with Clinic guide (tips, tours, or feedback).';

comment on column public.fi_guided_assist_preferences.engagement_last_active_date is
  'Last local clinic calendar date (YYYY-MM-DD) engagement was recorded for streak.';

-- ---------------------------------------------------------------------------
-- Tip helpfulness feedback (upsert per user + tip)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_guided_assist_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  fi_user_id uuid not null references public.fi_users (id) on delete cascade,
  tip_code text not null,
  helpful boolean not null,
  page_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_guided_assist_feedback_tip_code_chk check (
    char_length(trim(tip_code)) between 1 and 120
  )
);

create unique index if not exists idx_fi_guided_assist_feedback_user_tip
  on public.fi_guided_assist_feedback (tenant_id, fi_user_id, tip_code);

create index if not exists idx_fi_guided_assist_feedback_tenant_tip
  on public.fi_guided_assist_feedback (tenant_id, tip_code, updated_at desc);

comment on table public.fi_guided_assist_feedback is
  'Clinic guide tip/tour-step helpfulness (thumbs). Tenant + user isolated; operational only.';

alter table public.fi_guided_assist_feedback enable row level security;

drop policy if exists fi_guided_assist_feedback_select_own on public.fi_guided_assist_feedback;
create policy fi_guided_assist_feedback_select_own
  on public.fi_guided_assist_feedback for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_guided_assist_feedback.tenant_id
        and u.id = fi_guided_assist_feedback.fi_user_id
    )
  );

grant select on public.fi_guided_assist_feedback to authenticated, service_role;
grant insert, update, delete on public.fi_guided_assist_feedback to service_role;

drop trigger if exists trg_fi_guided_assist_feedback_updated_at on public.fi_guided_assist_feedback;
create trigger trg_fi_guided_assist_feedback_updated_at
  before update on public.fi_guided_assist_feedback
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- Event kinds for feedback + engagement touch (append to existing check)
-- ---------------------------------------------------------------------------
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
      'tour_completed'
    )
  );
