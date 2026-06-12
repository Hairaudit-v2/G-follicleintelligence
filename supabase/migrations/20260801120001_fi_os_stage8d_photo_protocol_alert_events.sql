-- Stage 8D: persisted photo protocol alert events (operational; idempotent upserts from computed rules).
-- Runbook: docs/runbooks/fi-os-stage8d-photo-protocol-alert-events.md

create table if not exists public.hli_photo_protocol_alert_events (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_record_id text,
  tenant_id uuid references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,
  patient_id uuid references public.fi_patients (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  protocol_session_id uuid not null references public.hli_photo_protocol_sessions (id) on delete cascade,
  alert_type text not null,
  severity text not null,
  status text not null default 'open',
  message text not null,
  recommended_action text,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by_user_id uuid references public.fi_users (id) on delete set null,
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hli_photo_protocol_alert_events_source_system_chk check (
    source_system in ('fi_os', 'hairaudit', 'hair_longevity')
  ),
  constraint hli_photo_protocol_alert_events_alert_type_chk check (
    alert_type in (
      'missing_required_images',
      'protocol_incomplete_over_24h',
      'needs_retake',
      'low_confidence_capture',
      'hairaudit_not_ready',
      'follow_up_missing_images'
    )
  ),
  constraint hli_photo_protocol_alert_events_severity_chk check (severity in ('low', 'medium', 'high')),
  constraint hli_photo_protocol_alert_events_status_chk check (
    status in ('open', 'acknowledged', 'resolved', 'dismissed')
  ),
  constraint hli_photo_protocol_alert_events_payload_object check (jsonb_typeof (payload) = 'object'),
  constraint hli_photo_protocol_alert_events_idempotency_key_len check (char_length (idempotency_key) >= 8),
  constraint hli_photo_protocol_alert_events_unique_idempotency unique (idempotency_key)
);

comment on table public.hli_photo_protocol_alert_events is
  'HLI Stage 8D: persisted operational alerts for smart clinical photography (idempotent; computed rules live in application code).';

create index if not exists idx_hli_photo_protocol_alert_events_tenant_status
  on public.hli_photo_protocol_alert_events (tenant_id, status);

create index if not exists idx_hli_photo_protocol_alert_events_tenant_severity
  on public.hli_photo_protocol_alert_events (tenant_id, severity);

create index if not exists idx_hli_photo_protocol_alert_events_tenant_alert_type
  on public.hli_photo_protocol_alert_events (tenant_id, alert_type);

create index if not exists idx_hli_photo_protocol_alert_events_protocol_session
  on public.hli_photo_protocol_alert_events (protocol_session_id);

create index if not exists idx_hli_photo_protocol_alert_events_patient
  on public.hli_photo_protocol_alert_events (patient_id);

create index if not exists idx_hli_photo_protocol_alert_events_case
  on public.hli_photo_protocol_alert_events (case_id);

create index if not exists idx_hli_photo_protocol_alert_events_last_detected
  on public.hli_photo_protocol_alert_events (last_detected_at desc);

alter table public.hli_photo_protocol_alert_events enable row level security;

grant select, insert, update, delete on public.hli_photo_protocol_alert_events to service_role;
grant select, update on public.hli_photo_protocol_alert_events to authenticated;

drop policy if exists hli_photo_protocol_alert_events_select_tenant_or_platform
  on public.hli_photo_protocol_alert_events;
create policy hli_photo_protocol_alert_events_select_tenant_or_platform
  on public.hli_photo_protocol_alert_events
  for select
  to authenticated
  using (
    tenant_id is not null
    and public.fi_os_can_select_clinical_intelligence_tenant_data (tenant_id)
  );

drop policy if exists hli_photo_protocol_alert_events_update_tenant_or_platform
  on public.hli_photo_protocol_alert_events;
create policy hli_photo_protocol_alert_events_update_tenant_or_platform
  on public.hli_photo_protocol_alert_events
  for update
  to authenticated
  using (
    tenant_id is not null
    and public.fi_os_can_select_clinical_intelligence_tenant_data (tenant_id)
  )
  with check (
    tenant_id is not null
    and public.fi_os_can_select_clinical_intelligence_tenant_data (tenant_id)
  );

drop trigger if exists trg_hli_photo_protocol_alert_events_set_updated_at on public.hli_photo_protocol_alert_events;
create trigger trg_hli_photo_protocol_alert_events_set_updated_at
  before update on public.hli_photo_protocol_alert_events
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();
