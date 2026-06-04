-- Stage 5C: Procedure day workflow (one row per case for now).
-- No HairAudit, surgical audit grading, photographic audit, or outcome tracking columns.

create table if not exists fi_case_procedures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  case_id uuid not null references fi_cases (id) on delete cascade,
  procedure_date date,
  procedure_status text not null default 'scheduled',
  surgeon_user_id uuid references fi_users (id) on delete set null,
  team_member_user_ids jsonb not null default '[]'::jsonb,
  procedure_location text,
  procedure_room text,
  start_time timestamptz,
  finish_time timestamptz,
  punch_size text,
  extraction_method text,
  implantation_method text,
  medication_notes text,
  intraoperative_notes text,
  grafts_extracted integer,
  grafts_implanted integer,
  hairs_implanted integer,
  graft_handling_notes text,
  complications_notes text,
  completion_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_case_procedures_tenant_case_unique unique (tenant_id, case_id),
  constraint fi_case_procedures_team_ids_array check (jsonb_typeof (team_member_user_ids) = 'array'),
  constraint fi_case_procedures_grafts_extracted_nonneg check (
    grafts_extracted is null or grafts_extracted >= 0
  ),
  constraint fi_case_procedures_grafts_implanted_nonneg check (
    grafts_implanted is null or grafts_implanted >= 0
  ),
  constraint fi_case_procedures_hairs_implanted_nonneg check (hairs_implanted is null or hairs_implanted >= 0),
  constraint fi_case_procedures_implanted_lte_extracted check (
    grafts_extracted is null
    or grafts_implanted is null
    or grafts_implanted <= grafts_extracted
  ),
  constraint fi_case_procedures_finish_after_start check (
    start_time is null or finish_time is null or finish_time >= start_time
  )
);

comment on table fi_case_procedures is
  'Stage 5C: structured procedure-day record for SurgeryOS (counts and notes only; no audit scoring or outcomes).';

create index if not exists idx_fi_case_procedures_tenant on fi_case_procedures (tenant_id);
create index if not exists idx_fi_case_procedures_case on fi_case_procedures (case_id);
