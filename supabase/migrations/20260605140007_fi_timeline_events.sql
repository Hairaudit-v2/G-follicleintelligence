-- Follicle Intelligence Foundation Layer (Stage 1C): case timeline (curated milestones)
-- See docs/design/07-foundation-migration-specification.md Section 2.7
-- Raw ingest remains in fi_events; optional fi_event_id provenance.

create table if not exists fi_timeline_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  case_id uuid not null references fi_cases (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  organisation_id uuid references fi_organisations (id) on delete set null,
  event_kind text not null,
  title text,
  detail jsonb,
  occurred_at timestamptz not null,
  fi_event_id uuid references fi_events (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table fi_timeline_events is 'Follicle Intelligence Foundation Layer: insert-only semantic timeline per case; links optionally to fi_events.';

create index if not exists idx_fi_timeline_events_tenant_case_occurred
  on fi_timeline_events (tenant_id, case_id, occurred_at desc);
create index if not exists idx_fi_timeline_events_fi_event
  on fi_timeline_events (fi_event_id)
  where fi_event_id is not null;
