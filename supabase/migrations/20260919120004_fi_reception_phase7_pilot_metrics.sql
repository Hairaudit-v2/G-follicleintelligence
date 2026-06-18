-- ReceptionOS Phase 7: pilot usage events + lightweight feedback (operational metadata only).

-- ---------------------------------------------------------------------------
-- fi_reception_usage_events
-- ---------------------------------------------------------------------------
create table if not exists public.fi_reception_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  profile_id uuid references public.fi_users (id) on delete set null,
  event_kind text not null
    check (event_kind in (
      'dashboard_viewed',
      'widget_viewed',
      'task_created',
      'task_actioned',
      'communication_previewed',
      'communication_dry_run_sent',
      'closeout_previewed',
      'day_closed',
      'refresh_failed'
    )),
  operating_mode text
    check (operating_mode is null or operating_mode in ('morning_prep', 'live_clinic', 'end_of_day')),
  widget_key text,
  task_id uuid references public.fi_reception_tasks (id) on delete set null,
  alert_kind text,
  source_ref_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_reception_usage_events_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_reception_usage_events is
  'ReceptionOS Phase 7: tenant-scoped operational usage events for pilot metrics (no message bodies or patient content).';

create index if not exists idx_fi_reception_usage_events_tenant_created
  on public.fi_reception_usage_events (tenant_id, created_at desc);

create index if not exists idx_fi_reception_usage_events_tenant_kind_created
  on public.fi_reception_usage_events (tenant_id, event_kind, created_at desc);

create index if not exists idx_fi_reception_usage_events_tenant_profile_created
  on public.fi_reception_usage_events (tenant_id, profile_id, created_at desc)
  where profile_id is not null;

alter table public.fi_reception_usage_events enable row level security;

drop policy if exists fi_reception_usage_events_select_tenant_member on public.fi_reception_usage_events;
create policy fi_reception_usage_events_select_tenant_member
  on public.fi_reception_usage_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_reception_usage_events.tenant_id
    )
  );

grant select on public.fi_reception_usage_events to authenticated, service_role;
grant insert, update, delete on public.fi_reception_usage_events to service_role;

-- ---------------------------------------------------------------------------
-- fi_reception_pilot_feedback
-- ---------------------------------------------------------------------------
create table if not exists public.fi_reception_pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  profile_id uuid references public.fi_users (id) on delete set null,
  feedback_kind text not null
    check (feedback_kind in (
      'useful',
      'missing_information',
      'wrong_alert',
      'workflow_friction'
    )),
  operating_mode text
    check (operating_mode is null or operating_mode in ('morning_prep', 'live_clinic', 'end_of_day')),
  widget_key text,
  task_id uuid references public.fi_reception_tasks (id) on delete set null,
  alert_kind text,
  source_ref_id text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_reception_pilot_feedback_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_reception_pilot_feedback_note_length check (note is null or char_length(note) <= 500)
);

comment on table public.fi_reception_pilot_feedback is
  'ReceptionOS Phase 7: lightweight pilot feedback linked to widgets, tasks, and alerts (no patient content).';

create index if not exists idx_fi_reception_pilot_feedback_tenant_created
  on public.fi_reception_pilot_feedback (tenant_id, created_at desc);

create index if not exists idx_fi_reception_pilot_feedback_tenant_kind_created
  on public.fi_reception_pilot_feedback (tenant_id, feedback_kind, created_at desc);

alter table public.fi_reception_pilot_feedback enable row level security;

drop policy if exists fi_reception_pilot_feedback_select_tenant_member on public.fi_reception_pilot_feedback;
create policy fi_reception_pilot_feedback_select_tenant_member
  on public.fi_reception_pilot_feedback for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_reception_pilot_feedback.tenant_id
    )
  );

grant select on public.fi_reception_pilot_feedback to authenticated, service_role;
grant insert, update, delete on public.fi_reception_pilot_feedback to service_role;
