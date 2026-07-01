-- WorkforceOS Phase 1C Sprint 1: identity reconciliation, duplicate detection, HR sync audit.

-- Extend fi_staff_members with source external id and merge/offboard tracking.
alter table public.fi_staff_members
  add column if not exists source_external_id text,
  add column if not exists merged_into uuid references public.fi_staff_members (id) on delete set null,
  add column if not exists merged_at timestamptz,
  add column if not exists offboarded_at timestamptz;

create index if not exists idx_fi_staff_members_tenant_source_external
  on public.fi_staff_members (tenant_id, source_system, source_external_id)
  where archived_at is null and source_external_id is not null;

create index if not exists idx_fi_staff_members_merged_into
  on public.fi_staff_members (merged_into)
  where merged_into is not null;

-- Identity links: auditable IIOHR ↔ FI OS staff member mapping.
create table if not exists public.fi_staff_identity_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  source_system text not null,
  external_id text not null,
  external_email text,
  external_name text,
  identity_confidence numeric not null default 1,
  match_method text,
  linked_at timestamptz not null default now(),
  linked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_identity_links_confidence_range check (
    identity_confidence >= 0 and identity_confidence <= 1
  )
);

comment on table public.fi_staff_identity_links is
  'WorkforceOS auditable identity links between FI staff members and external HR systems.';

alter table public.fi_staff_identity_links
  drop constraint if exists fi_staff_identity_links_tenant_source_external_key;

alter table public.fi_staff_identity_links
  add constraint fi_staff_identity_links_tenant_source_external_key
  unique (tenant_id, source_system, external_id);

create index if not exists idx_fi_staff_identity_links_staff_member
  on public.fi_staff_identity_links (tenant_id, staff_member_id);

-- Duplicate candidate pairs for manual review (Sprint 1: detect only, no auto-merge).
create table if not exists public.fi_staff_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_a_id uuid not null references public.fi_staff_members (id) on delete cascade,
  staff_b_id uuid not null references public.fi_staff_members (id) on delete cascade,
  match_email boolean not null default false,
  match_name boolean not null default false,
  match_phone boolean not null default false,
  role_similarity boolean not null default false,
  similarity_score numeric not null default 0,
  status text not null default 'open',
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_duplicate_candidates_distinct_pair check (staff_a_id <> staff_b_id),
  constraint fi_staff_duplicate_candidates_sorted_pair check (staff_a_id < staff_b_id),
  constraint fi_staff_duplicate_candidates_status_chk check (
    status in ('open', 'dismissed', 'merged', 'manual_linked')
  )
);

comment on table public.fi_staff_duplicate_candidates is
  'Open duplicate staff member pairs detected during HR sync reconciliation.';

alter table public.fi_staff_duplicate_candidates
  drop constraint if exists fi_staff_duplicate_candidates_pair_key;

alter table public.fi_staff_duplicate_candidates
  add constraint fi_staff_duplicate_candidates_pair_key
  unique (tenant_id, staff_a_id, staff_b_id);

create index if not exists idx_fi_staff_duplicate_candidates_tenant_status
  on public.fi_staff_duplicate_candidates (tenant_id, status, similarity_score desc);

-- HR sync audit runs (WorkforceOS reconciliation layer; complements fi_staff_sync_runs).
create table if not exists public.fi_hr_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  run_id uuid not null,
  source_system text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_received integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_linked integer not null default 0,
  duplicates_detected integer not null default 0,
  records_skipped integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  status text not null default 'running',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hr_sync_runs_warnings_array check (jsonb_typeof(warnings) = 'array'),
  constraint fi_hr_sync_runs_errors_array check (jsonb_typeof(errors) = 'array'),
  constraint fi_hr_sync_runs_status_chk check (
    status in ('running', 'success', 'failed', 'partial')
  )
);

comment on table public.fi_hr_sync_runs is
  'WorkforceOS HR sync audit runs with identity reconciliation and duplicate detection metrics.';

create index if not exists idx_fi_hr_sync_runs_tenant_started
  on public.fi_hr_sync_runs (tenant_id, started_at desc);

create unique index if not exists idx_fi_hr_sync_runs_run_id
  on public.fi_hr_sync_runs (run_id);

-- RLS: tenant admins / owners / hr_manager read; service_role write.
alter table public.fi_staff_identity_links enable row level security;
alter table public.fi_staff_duplicate_candidates enable row level security;
alter table public.fi_hr_sync_runs enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_staff_identity_links_select_hr_admin on public.fi_staff_identity_links;
    create policy fi_staff_identity_links_select_hr_admin
      on public.fi_staff_identity_links for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_staff_identity_links.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );

    drop policy if exists fi_staff_duplicate_candidates_select_hr_admin on public.fi_staff_duplicate_candidates;
    create policy fi_staff_duplicate_candidates_select_hr_admin
      on public.fi_staff_duplicate_candidates for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_staff_duplicate_candidates.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );

    drop policy if exists fi_hr_sync_runs_select_hr_admin on public.fi_hr_sync_runs;
    create policy fi_hr_sync_runs_select_hr_admin
      on public.fi_hr_sync_runs for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_hr_sync_runs.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );

    grant select on public.fi_staff_identity_links to authenticated;
    grant select on public.fi_staff_duplicate_candidates to authenticated;
    grant select on public.fi_hr_sync_runs to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_staff_identity_links to service_role;
grant select, insert, update, delete on public.fi_staff_duplicate_candidates to service_role;
grant select, insert, update, delete on public.fi_hr_sync_runs to service_role;