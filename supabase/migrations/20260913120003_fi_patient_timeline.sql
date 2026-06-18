-- HubSpot Timeline Sync Engine — Phase 1.
-- Append-only patient communication / CRM activity history sourced from external systems
-- (HubSpot first). This NEVER overwrites patient/person/lead records — it is a separate stream.

create table if not exists fi_patient_timeline (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete cascade,
  person_id uuid references fi_persons (id) on delete cascade,
  crm_lead_id uuid references fi_crm_leads (id) on delete set null,
  source text not null,
  event_type text not null,
  event_timestamp timestamptz not null,
  title text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_patient_timeline_has_anchor check (
    patient_id is not null or person_id is not null or crm_lead_id is not null
  ),
  constraint fi_patient_timeline_source_nonempty check (char_length(trim(source)) > 0),
  constraint fi_patient_timeline_event_type_nonempty check (char_length(trim(event_type)) > 0),
  constraint fi_patient_timeline_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_patient_timeline is
  'Append-only external communication / CRM activity history per patient/person/lead (HubSpot timeline sync, etc.). Not a source of truth for patient records.';

create index if not exists idx_fi_patient_timeline_tenant_patient_ts
  on fi_patient_timeline (tenant_id, patient_id, event_timestamp desc)
  where patient_id is not null;

create index if not exists idx_fi_patient_timeline_tenant_person_ts
  on fi_patient_timeline (tenant_id, person_id, event_timestamp desc)
  where person_id is not null;

create index if not exists idx_fi_patient_timeline_tenant_lead_ts
  on fi_patient_timeline (tenant_id, crm_lead_id, event_timestamp desc)
  where crm_lead_id is not null;

-- Idempotency: a delivered event carries a stable dedupe_key in metadata so retried/duplicate
-- HubSpot deliveries do not append the same activity twice (INSERT ... ON CONFLICT DO NOTHING).
create unique index if not exists uq_fi_patient_timeline_dedupe
  on fi_patient_timeline (tenant_id, source, event_type, (metadata ->> 'dedupe_key'))
  where (metadata ->> 'dedupe_key') is not null;

alter table fi_patient_timeline enable row level security;

drop policy if exists fi_patient_timeline_select_tenant_member on fi_patient_timeline;
create policy fi_patient_timeline_select_tenant_member
  on fi_patient_timeline for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_timeline.tenant_id
    )
  );

grant select on fi_patient_timeline to authenticated, service_role;
grant insert, update, delete on fi_patient_timeline to service_role;
