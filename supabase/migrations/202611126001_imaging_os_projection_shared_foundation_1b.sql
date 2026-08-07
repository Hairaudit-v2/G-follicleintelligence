-- FI-SURGERY-PROJECTION-SHARED-FOUNDATION-1B
-- Shared projection technical SoR + product refs + FiOS photo-bound hairline designs.
-- Clinical approval / patient sharing remain product-owned (not shared lifecycle "approved").
-- Access: service_role for shared generations; tenant-scoped RLS hooks for FiOS hairline tables.

-- ---------------------------------------------------------------------------
-- Shared technical generations (ImagingOS capability — not FiOS page tables)
-- ---------------------------------------------------------------------------

create table if not exists public.imaging_os_projection_generations (
  id uuid primary key default gen_random_uuid(),
  contract_version text not null default 'fi-shared-projection-request-v1',
  tenant_id uuid not null references public.fi_tenants (id),
  patient_subject_ref text not null,
  fios_case_id uuid references public.fi_cases (id) on delete set null,
  hairaudit_case_ref text,
  artifact_type text not null
    check (artifact_type in (
      'graft_allocation_map',
      'proposed_hairline_design',
      'illustrative_projected_outcome'
    )),
  lifecycle_status text not null
    check (lifecycle_status in (
      'awaiting_plan_approval',
      'awaiting_hairline_approval',
      'ready_to_generate',
      'generation_requested',
      'processing',
      'provider_completed',
      'asset_validating',
      'technical_review_required',
      'clinician_review',
      'technically_rejected',
      'provider_failed',
      'superseded'
    )),
  surgical_plan_id text not null,
  surgical_plan_version int not null check (surgical_plan_version >= 1),
  hairline_design_id text not null,
  hairline_design_version int not null check (hairline_design_version >= 1),
  source_image_ref text not null,
  source_image_checksum text not null,
  source_view text not null,
  treatment_mask_ref text,
  treatment_mask_checksum text not null,
  preservation_mask_ref text,
  preservation_mask_checksum text,
  projection_mode text not null
    check (projection_mode in ('conservative', 'planned', 'optimistic_within_approved_range')),
  provider_id text not null,
  model_version text not null,
  prompt_template_version text not null,
  provider_generation_id text,
  idempotency_key text not null,
  correlation_id text,
  requesting_product text not null
    check (requesting_product in ('fios', 'hairaudit', 'patient_os')),
  output_storage_ref text,
  output_checksum text,
  mime_type text,
  width_px int,
  height_px int,
  byte_size int,
  technical_validation jsonb,
  warnings jsonb not null default '[]'::jsonb,
  failure_category text,
  patient_safe_failure_message text,
  immutable_request_snapshot jsonb not null default '{}'::jsonb,
  superseded_by_generation_id uuid references public.imaging_os_projection_generations (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint imaging_os_projection_generations_idempotency_uidx
    unique (tenant_id, idempotency_key)
);

comment on table public.imaging_os_projection_generations is
  'FI-SURGERY-PROJECTION-SHARED-FOUNDATION-1B: provider-neutral technical projection generations. No clinical product approval or patient-sharing state.';

create index if not exists idx_imaging_os_proj_gen_tenant_created
  on public.imaging_os_projection_generations (tenant_id, created_at desc);

create index if not exists idx_imaging_os_proj_gen_subject
  on public.imaging_os_projection_generations (patient_subject_ref, created_at desc);

create index if not exists idx_imaging_os_proj_gen_fios_case
  on public.imaging_os_projection_generations (fios_case_id)
  where fios_case_id is not null;

create index if not exists idx_imaging_os_proj_gen_ha_case
  on public.imaging_os_projection_generations (hairaudit_case_ref)
  where hairaudit_case_ref is not null;

-- ---------------------------------------------------------------------------
-- Product-owned clinical / audit / sharing decisions referencing shared assets
-- ---------------------------------------------------------------------------

create table if not exists public.imaging_os_projection_product_refs (
  id uuid primary key default gen_random_uuid(),
  shared_generation_id uuid not null
    references public.imaging_os_projection_generations (id) on delete cascade,
  product text not null check (product in ('fios', 'hairaudit', 'patient_os')),
  local_case_id text not null,
  local_review_status text not null default 'not_reviewed'
    check (local_review_status in (
      'not_reviewed',
      'accepted_for_review',
      'clinically_accepted',
      'clinically_rejected',
      'correction_requested',
      'excluded_from_report'
    )),
  local_reviewer_id text,
  local_decision_note text,
  correction_request text,
  patient_sharing_decision text not null default 'unavailable'
    check (patient_sharing_decision in (
      'unavailable',
      'denied',
      'pending',
      'allowed'
    )),
  authorised_consumer boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint imaging_os_projection_product_refs_uidx
    unique (shared_generation_id, product, local_case_id)
);

comment on table public.imaging_os_projection_product_refs is
  'Product-specific clinical/audit/sharing decisions for a shared generation. HairAudit reject must not mutate FiOS plan/hairline approval.';

create index if not exists idx_imaging_os_proj_product_refs_case
  on public.imaging_os_projection_product_refs (product, local_case_id);

-- ---------------------------------------------------------------------------
-- Usage / cost ledger (per generation)
-- ---------------------------------------------------------------------------

create table if not exists public.imaging_os_projection_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id),
  shared_generation_id uuid references public.imaging_os_projection_generations (id)
    on delete set null,
  provider_id text not null,
  model_version text,
  requesting_product text not null,
  event_kind text not null
    check (event_kind in ('generation_attempt', 'generation_completed', 'generation_failed', 'idempotent_hit')),
  estimated_cost_usd numeric(12, 6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.imaging_os_projection_usage_events is
  'Per-generation usage/cost recording for shared projection service.';

-- ---------------------------------------------------------------------------
-- FiOS photo-bound hairline designs (clinical SoR)
-- ---------------------------------------------------------------------------

create table if not exists public.fi_case_hairline_designs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  case_id uuid not null references public.fi_cases (id) on delete cascade,
  surgical_plan_id uuid not null references public.fi_case_surgery_plans (id) on delete cascade,
  design_version int not null check (design_version >= 1),
  status text not null default 'draft'
    check (status in ('draft', 'awaiting_review', 'approved', 'rejected', 'superseded')),
  source_image_id text,
  source_image_ref text not null,
  source_image_checksum text not null,
  source_view text not null default 'frontal',
  image_width_px int,
  image_height_px int,
  orientation_degrees int not null default 0,
  geometry jsonb not null default '{}'::jsonb,
  author_user_id text,
  approved_by text,
  approved_at timestamptz,
  rejected_by text,
  rejected_at timestamptz,
  rejection_reason text,
  supersedes_design_id uuid references public.fi_case_hairline_designs (id),
  superseded_by_design_id uuid references public.fi_case_hairline_designs (id),
  render_storage_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_case_hairline_designs_version_uidx unique (tenant_id, case_id, design_version)
);

comment on table public.fi_case_hairline_designs is
  'FI-SURGERY-PROJECTION-SHARED-FOUNDATION-1B: photo-bound, versioned FiOS hairline design SoR. Consultation SVG alone is insufficient.';

create index if not exists idx_fi_case_hairline_designs_case
  on public.fi_case_hairline_designs (tenant_id, case_id, design_version desc);

create index if not exists idx_fi_case_hairline_designs_plan
  on public.fi_case_hairline_designs (surgical_plan_id, status);

-- ---------------------------------------------------------------------------
-- FiOS hairline / projection audit events (bounded, no PHI bodies)
-- ---------------------------------------------------------------------------

create table if not exists public.fi_case_surgery_projection_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  case_id uuid not null references public.fi_cases (id) on delete cascade,
  event_kind text not null,
  actor_user_id text,
  hairline_design_id uuid references public.fi_case_hairline_designs (id) on delete set null,
  shared_generation_id uuid references public.imaging_os_projection_generations (id)
    on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.fi_case_surgery_projection_events is
  'Bounded audit timeline for FiOS hairline / projection foundation events. No PHI snapshot bodies.';

create index if not exists idx_fi_case_surg_proj_events_case
  on public.fi_case_surgery_projection_events (tenant_id, case_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.imaging_os_projection_generations enable row level security;
alter table public.imaging_os_projection_product_refs enable row level security;
alter table public.imaging_os_projection_usage_events enable row level security;
alter table public.fi_case_hairline_designs enable row level security;
alter table public.fi_case_surgery_projection_events enable row level security;

revoke all on public.imaging_os_projection_generations from public;
revoke all on public.imaging_os_projection_product_refs from public;
revoke all on public.imaging_os_projection_usage_events from public;
revoke all on public.fi_case_hairline_designs from public;
revoke all on public.fi_case_surgery_projection_events from public;

grant select, insert, update, delete on public.imaging_os_projection_generations to service_role;
grant select, insert, update, delete on public.imaging_os_projection_product_refs to service_role;
grant select, insert, update, delete on public.imaging_os_projection_usage_events to service_role;
grant select, insert, update, delete on public.fi_case_hairline_designs to service_role;
grant select, insert, update, delete on public.fi_case_surgery_projection_events to service_role;

-- Private storage for hairline design renders (reuse bucket if present)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pre-surgery-projections',
  'pre-surgery-projections',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
