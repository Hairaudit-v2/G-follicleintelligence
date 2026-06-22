-- AcademyOS Phase C — procedure privilege engine (operational authorization layer).
-- IIOHR certifies learning; AcademyOS authorizes clinic-permitted procedures.
-- Prerequisite: 20260922120004_academy_os_competency_projection.sql (fi_staff_competency_projections).

-- ---------------------------------------------------------------------------
-- fi_staff_procedure_privileges
-- ---------------------------------------------------------------------------

create table if not exists public.fi_staff_procedure_privileges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete cascade,
  staff_id uuid not null references public.fi_staff (id) on delete cascade,
  procedure_key text not null,
  privilege_level text not null default 'assist',
  privilege_status text not null default 'active',
  source_system text not null default 'fi_os',
  source_competency_key text,
  source_projection_id uuid references public.fi_staff_competency_projections (id) on delete set null,
  granted_by uuid references public.fi_users (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  reviewed_at timestamptz,
  review_due_at timestamptz,
  restriction_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_procedure_privileges_procedure_key_nonempty check (char_length(trim(procedure_key)) > 0),
  constraint fi_staff_procedure_privileges_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_staff_procedure_privileges_level check (
    privilege_level in ('observe', 'assist', 'perform_supervised', 'perform_independent', 'train_others')
  ),
  constraint fi_staff_procedure_privileges_status check (
    privilege_status in ('active', 'pending_review', 'suspended', 'expired', 'revoked')
  ),
  constraint fi_staff_procedure_privileges_expires_after_granted check (
    expires_at is null or expires_at > granted_at
  )
);

comment on table public.fi_staff_procedure_privileges is
  'AcademyOS: tenant-scoped operational permissions for staff to perform or assist procedures. Not IIOHR certification.';

comment on column public.fi_staff_procedure_privileges.clinic_id is
  'Null = tenant-wide privilege; clinic-specific rows override tenant-wide for the same procedure.';

create unique index if not exists idx_fi_staff_procedure_privileges_active_unique
  on public.fi_staff_procedure_privileges (
    tenant_id,
    coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid),
    staff_id,
    procedure_key,
    privilege_level
  )
  where privilege_status in ('active', 'pending_review');

create index if not exists idx_fi_staff_procedure_privileges_tenant_id
  on public.fi_staff_procedure_privileges (tenant_id);

create index if not exists idx_fi_staff_procedure_privileges_tenant_staff
  on public.fi_staff_procedure_privileges (tenant_id, staff_id);

create index if not exists idx_fi_staff_procedure_privileges_tenant_clinic
  on public.fi_staff_procedure_privileges (tenant_id, clinic_id)
  where clinic_id is not null;

create index if not exists idx_fi_staff_procedure_privileges_tenant_procedure
  on public.fi_staff_procedure_privileges (tenant_id, procedure_key);

create index if not exists idx_fi_staff_procedure_privileges_tenant_status
  on public.fi_staff_procedure_privileges (tenant_id, privilege_status);

create index if not exists idx_fi_staff_procedure_privileges_source_projection
  on public.fi_staff_procedure_privileges (source_projection_id)
  where source_projection_id is not null;

alter table public.fi_staff_procedure_privileges enable row level security;

drop policy if exists fi_staff_procedure_privileges_select_tenant_member
  on public.fi_staff_procedure_privileges;
create policy fi_staff_procedure_privileges_select_tenant_member
  on public.fi_staff_procedure_privileges for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_procedure_privileges.tenant_id
    )
  );

drop policy if exists fi_staff_procedure_privileges_insert_privileged_roles
  on public.fi_staff_procedure_privileges;
create policy fi_staff_procedure_privileges_insert_privileged_roles
  on public.fi_staff_procedure_privileges for insert to authenticated
  with check (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_procedure_privileges.tenant_id
        and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
    )
  );

drop policy if exists fi_staff_procedure_privileges_update_privileged_roles
  on public.fi_staff_procedure_privileges;
create policy fi_staff_procedure_privileges_update_privileged_roles
  on public.fi_staff_procedure_privileges for update to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_procedure_privileges.tenant_id
        and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
    )
  )
  with check (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_procedure_privileges.tenant_id
        and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
    )
  );

drop policy if exists fi_staff_procedure_privileges_delete_privileged_roles
  on public.fi_staff_procedure_privileges;
create policy fi_staff_procedure_privileges_delete_privileged_roles
  on public.fi_staff_procedure_privileges for delete to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_procedure_privileges.tenant_id
        and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
    )
  );

grant select on public.fi_staff_procedure_privileges to authenticated, service_role;
grant insert, update, delete on public.fi_staff_procedure_privileges to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- fi_procedure_privilege_requirements
-- ---------------------------------------------------------------------------

create table if not exists public.fi_procedure_privilege_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete cascade,
  event_type text not null,
  assigned_role text not null,
  required_procedure_key text not null,
  minimum_privilege_level text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_procedure_privilege_requirements_event_type_nonempty check (char_length(trim(event_type)) > 0),
  constraint fi_procedure_privilege_requirements_role_nonempty check (char_length(trim(assigned_role)) > 0),
  constraint fi_procedure_privilege_requirements_procedure_nonempty check (char_length(trim(required_procedure_key)) > 0),
  constraint fi_procedure_privilege_requirements_level check (
    minimum_privilege_level in ('observe', 'assist', 'perform_supervised', 'perform_independent', 'train_others')
  )
);

comment on table public.fi_procedure_privilege_requirements is
  'AcademyOS: required procedure privilege levels per clinical event role. Multiple rows per role = OR (any satisfies).';

create unique index if not exists idx_fi_procedure_privilege_requirements_active_unique
  on public.fi_procedure_privilege_requirements (
    tenant_id,
    coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid),
    event_type,
    assigned_role,
    required_procedure_key
  )
  where is_active = true;

create index if not exists idx_fi_procedure_privilege_requirements_tenant_id
  on public.fi_procedure_privilege_requirements (tenant_id);

create index if not exists idx_fi_procedure_privilege_requirements_tenant_event
  on public.fi_procedure_privilege_requirements (tenant_id, event_type)
  where is_active = true;

create index if not exists idx_fi_procedure_privilege_requirements_tenant_clinic
  on public.fi_procedure_privilege_requirements (tenant_id, clinic_id)
  where clinic_id is not null and is_active = true;

alter table public.fi_procedure_privilege_requirements enable row level security;

drop policy if exists fi_procedure_privilege_requirements_select_tenant_member
  on public.fi_procedure_privilege_requirements;
create policy fi_procedure_privilege_requirements_select_tenant_member
  on public.fi_procedure_privilege_requirements for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_procedure_privilege_requirements.tenant_id
    )
  );

drop policy if exists fi_procedure_privilege_requirements_insert_privileged_roles
  on public.fi_procedure_privilege_requirements;
create policy fi_procedure_privilege_requirements_insert_privileged_roles
  on public.fi_procedure_privilege_requirements for insert to authenticated
  with check (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_procedure_privilege_requirements.tenant_id
        and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
    )
  );

drop policy if exists fi_procedure_privilege_requirements_update_privileged_roles
  on public.fi_procedure_privilege_requirements;
create policy fi_procedure_privilege_requirements_update_privileged_roles
  on public.fi_procedure_privilege_requirements for update to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_procedure_privilege_requirements.tenant_id
        and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
    )
  )
  with check (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_procedure_privilege_requirements.tenant_id
        and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
    )
  );

drop policy if exists fi_procedure_privilege_requirements_delete_privileged_roles
  on public.fi_procedure_privilege_requirements;
create policy fi_procedure_privilege_requirements_delete_privileged_roles
  on public.fi_procedure_privilege_requirements for delete to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_procedure_privilege_requirements.tenant_id
        and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
    )
  );

grant select on public.fi_procedure_privilege_requirements to authenticated, service_role;
grant insert, update, delete on public.fi_procedure_privilege_requirements to authenticated, service_role;
