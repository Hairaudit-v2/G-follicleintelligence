-- Digital twin foundation (minimal): network subject anchor + tenant↔patient membership bridge.
-- Additive only; no fi_patients / fi_cases changes; no backfill; no application wiring yet.
-- Tenant alignment for (tenant_id, patient_id) on fi_network_subject_members is enforced in DB (see 20260821120002 migration).

create table if not exists fi_network_subjects (
  id uuid primary key default gen_random_uuid(),
  display_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fi_network_subjects is
  'Network-wide person-level anchor for deduplication and longitudinal correlation (not a clinical record; minimal PII).';

comment on column fi_network_subjects.display_label is
  'Optional non-clinical operator label; not authoritative identity.';

create table if not exists fi_network_subject_members (
  id uuid primary key default gen_random_uuid(),
  network_subject_id uuid not null references fi_network_subjects (id) on delete restrict,
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  membership_status text not null default 'active'
    constraint fi_network_subject_members_status_chk
      check (membership_status in ('active', 'superseded', 'revoked')),
  link_kind text
    constraint fi_network_subject_members_link_kind_chk
      check (link_kind is null or link_kind in ('asserted', 'resolved', 'imported')),
  confidence numeric,
  linked_at timestamptz not null default now(),
  linked_by uuid references fi_users (id) on delete set null,
  unlink_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fi_network_subject_members is
  'Bridge from fi_patients (tenant clinical relationship) to fi_network_subjects; retains superseded/revoked rows for audit.';

comment on column fi_network_subject_members.membership_status is
  'active = current link; superseded = replaced by a newer assertion; revoked = explicitly removed.';

comment on column fi_network_subject_members.link_kind is
  'Provenance of the link when asserted (null until populated by a future linking pipeline).';

create index if not exists idx_fi_network_subject_members_subject
  on fi_network_subject_members (network_subject_id);

create index if not exists idx_fi_network_subject_members_tenant_patient
  on fi_network_subject_members (tenant_id, patient_id);

create unique index if not exists fi_network_subject_members_one_active_patient_per_tenant
  on fi_network_subject_members (tenant_id, patient_id)
  where membership_status = 'active';

-- ---------- RLS (authenticated: tenant-scoped SELECT; writes via service_role routes) ----------

alter table fi_network_subjects enable row level security;
alter table fi_network_subject_members enable row level security;

drop policy if exists fi_network_subjects_select_tenant_member on fi_network_subjects;
create policy fi_network_subjects_select_tenant_member
  on fi_network_subjects for select to authenticated
  using (
    exists (
      select 1
      from fi_network_subject_members m
      join fi_users u on u.tenant_id = m.tenant_id
      where m.network_subject_id = fi_network_subjects.id
        and u.auth_user_id = auth.uid()
    )
  );

drop policy if exists fi_network_subject_members_select_tenant_member on fi_network_subject_members;
create policy fi_network_subject_members_select_tenant_member
  on fi_network_subject_members for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_network_subject_members.tenant_id
    )
  );
