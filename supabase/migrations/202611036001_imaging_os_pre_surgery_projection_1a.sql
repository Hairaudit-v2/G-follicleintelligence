-- FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A
-- Pre-surgery projection jobs, replay protection, private storage.
-- Access: service_role only (Next.js gateway). No authenticated/anon grants.

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create table if not exists public.imaging_os_pre_surgery_projection_jobs (
  id uuid primary key default gen_random_uuid(),
  source_channel text not null
    check (source_channel in ('hairaudit_service', 'fios_clinic')),
  service_source text not null,
  tenant_id uuid not null references public.fi_tenants (id),
  clinic_id uuid not null,
  case_id text not null,
  external_case_id text,
  external_projection_id text,
  patient_id uuid,
  procedure_id uuid,
  idempotency_key text not null,
  input_checksum text not null,
  schema_version text not null,
  mode text not null
    check (mode in ('conservative', 'planned', 'optimistic_within_approved_range')),
  model_version text not null,
  status text not null
    check (status in (
      'received', 'validated', 'queued', 'generating',
      'completed', 'failed', 'timed_out', 'cancelled'
    )),
  request_payload_checksum text not null,
  provider_name text not null,
  provider_request_id text,
  provider_response_id text,
  output_storage_ref text,
  output_checksum text,
  error_code text,
  error_message_safe text,
  attempt_count int not null default 0,
  clinician_review_state text not null default 'not_applicable'
    check (clinician_review_state in (
      'not_applicable', 'awaiting_review', 'approved', 'rejected', 'superseded'
    )),
  patient_visibility_eligibility text not null default 'ineligible'
    check (patient_visibility_eligibility in (
      'ineligible', 'eligible_after_approval', 'shared'
    )),
  superseded_by_job_id uuid references public.imaging_os_pre_surgery_projection_jobs (id),
  stale_reason text,
  immutable_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint imaging_os_pre_surgery_projection_jobs_idempotency_uidx
    unique (service_source, case_id, idempotency_key)
);

comment on table public.imaging_os_pre_surgery_projection_jobs is
  'FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A: projection generation jobs for HairAudit + FiOS clinic channels. Service-role only.';

create index if not exists idx_imaging_os_psp_jobs_tenant_created
  on public.imaging_os_pre_surgery_projection_jobs (tenant_id, created_at desc);

create index if not exists idx_imaging_os_psp_jobs_status
  on public.imaging_os_pre_surgery_projection_jobs (status, updated_at desc);

create index if not exists idx_imaging_os_psp_jobs_external_projection
  on public.imaging_os_pre_surgery_projection_jobs (external_projection_id)
  where external_projection_id is not null;

-- ---------------------------------------------------------------------------
-- Replay protection (signed request nonces)
-- ---------------------------------------------------------------------------

create table if not exists public.imaging_os_pre_surgery_projection_replays (
  service_source text not null,
  replay_key text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (service_source, replay_key)
);

comment on table public.imaging_os_pre_surgery_projection_replays is
  'Replay protection for signed HairAudit projection requests. Service-role only; purge after expires_at.';

create index if not exists idx_imaging_os_psp_replays_expires
  on public.imaging_os_pre_surgery_projection_replays (expires_at);

-- ---------------------------------------------------------------------------
-- Optional integration mapping (server-controlled; env remains primary for 1A)
-- ---------------------------------------------------------------------------

create table if not exists public.imaging_os_pre_surgery_projection_integrations (
  id uuid primary key default gen_random_uuid(),
  service_source text not null unique,
  external_org_key text not null,
  tenant_id uuid not null references public.fi_tenants (id),
  clinic_id uuid not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.imaging_os_pre_surgery_projection_integrations is
  'Server-controlled mapping from external projection integrations to FiOS tenant/clinic. Never trust client-supplied tenant IDs.';

-- ---------------------------------------------------------------------------
-- RLS: service_role only
-- ---------------------------------------------------------------------------

alter table public.imaging_os_pre_surgery_projection_jobs enable row level security;
alter table public.imaging_os_pre_surgery_projection_replays enable row level security;
alter table public.imaging_os_pre_surgery_projection_integrations enable row level security;

revoke all on public.imaging_os_pre_surgery_projection_jobs from public;
revoke all on public.imaging_os_pre_surgery_projection_replays from public;
revoke all on public.imaging_os_pre_surgery_projection_integrations from public;

grant select, insert, update, delete on public.imaging_os_pre_surgery_projection_jobs to service_role;
grant select, insert, update, delete on public.imaging_os_pre_surgery_projection_replays to service_role;
grant select, insert, update, delete on public.imaging_os_pre_surgery_projection_integrations to service_role;

-- ---------------------------------------------------------------------------
-- Private storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pre-surgery-projections',
  'pre-surgery-projections',
  false,
  15728640, -- 15 MB
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage policies for authenticated/anon — service role bypasses RLS for uploads.
