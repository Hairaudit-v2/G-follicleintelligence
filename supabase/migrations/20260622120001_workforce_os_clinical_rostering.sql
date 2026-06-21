-- WorkforceOS Phase 2C — clinical rostering schema (shifts, availability, templates, assignments).

-- ---------------------------------------------------------------------------
-- fi_staff_availability_blocks
-- ---------------------------------------------------------------------------

create table if not exists fi_staff_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  staff_id uuid not null references fi_staff (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete set null,
  block_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active',
  reason text,
  created_by uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_availability_blocks_time_range check (starts_at < ends_at),
  constraint fi_staff_availability_blocks_block_type check (
    block_type in ('unavailable', 'leave', 'sick_leave', 'training', 'admin', 'available_override')
  ),
  constraint fi_staff_availability_blocks_status check (status in ('active', 'cancelled'))
);

comment on table fi_staff_availability_blocks is
  'WorkforceOS: exceptions to normal working hours (leave, training, overrides).';

create index if not exists idx_fi_staff_availability_blocks_tenant
  on fi_staff_availability_blocks (tenant_id);

create index if not exists idx_fi_staff_availability_blocks_tenant_staff
  on fi_staff_availability_blocks (tenant_id, staff_id);

create index if not exists idx_fi_staff_availability_blocks_tenant_clinic
  on fi_staff_availability_blocks (tenant_id, clinic_id)
  where clinic_id is not null;

create index if not exists idx_fi_staff_availability_blocks_tenant_starts
  on fi_staff_availability_blocks (tenant_id, starts_at);

create index if not exists idx_fi_staff_availability_blocks_tenant_ends
  on fi_staff_availability_blocks (tenant_id, ends_at);

alter table fi_staff_availability_blocks enable row level security;

drop policy if exists fi_staff_availability_blocks_select_tenant_member on fi_staff_availability_blocks;
create policy fi_staff_availability_blocks_select_tenant_member
  on fi_staff_availability_blocks for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_availability_blocks.tenant_id
    )
  );

grant select on fi_staff_availability_blocks to authenticated, service_role;
grant insert, update, delete on fi_staff_availability_blocks to service_role;

-- ---------------------------------------------------------------------------
-- fi_staff_shifts
-- ---------------------------------------------------------------------------

create table if not exists fi_staff_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete set null,
  staff_id uuid not null references fi_staff (id) on delete cascade,
  shift_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled',
  notes text,
  created_by uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_shifts_time_range check (starts_at < ends_at),
  constraint fi_staff_shifts_shift_type check (
    shift_type in (
      'clinic_day',
      'surgery_day',
      'consultation_day',
      'procedure_day',
      'training_day',
      'admin_day',
      'on_call'
    )
  ),
  constraint fi_staff_shifts_status check (status in ('scheduled', 'confirmed', 'completed', 'cancelled'))
);

comment on table fi_staff_shifts is
  'WorkforceOS: planned working shifts for clinical and operational staff.';

create index if not exists idx_fi_staff_shifts_tenant
  on fi_staff_shifts (tenant_id);

create index if not exists idx_fi_staff_shifts_tenant_staff
  on fi_staff_shifts (tenant_id, staff_id);

create index if not exists idx_fi_staff_shifts_tenant_clinic
  on fi_staff_shifts (tenant_id, clinic_id)
  where clinic_id is not null;

create index if not exists idx_fi_staff_shifts_tenant_starts
  on fi_staff_shifts (tenant_id, starts_at);

create index if not exists idx_fi_staff_shifts_tenant_ends
  on fi_staff_shifts (tenant_id, ends_at);

alter table fi_staff_shifts enable row level security;

drop policy if exists fi_staff_shifts_select_tenant_member on fi_staff_shifts;
create policy fi_staff_shifts_select_tenant_member
  on fi_staff_shifts for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_shifts.tenant_id
    )
  );

grant select on fi_staff_shifts to authenticated, service_role;
grant insert, update, delete on fi_staff_shifts to service_role;

-- ---------------------------------------------------------------------------
-- fi_clinical_staffing_templates
-- ---------------------------------------------------------------------------

create table if not exists fi_clinical_staffing_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete cascade,
  event_type text not null,
  required_roles jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_clinical_staffing_templates_required_roles_object check (jsonb_typeof(required_roles) = 'object')
);

comment on table fi_clinical_staffing_templates is
  'WorkforceOS: required staff role counts by clinical event type.';

create index if not exists idx_fi_clinical_staffing_templates_tenant
  on fi_clinical_staffing_templates (tenant_id);

create index if not exists idx_fi_clinical_staffing_templates_tenant_clinic
  on fi_clinical_staffing_templates (tenant_id, clinic_id);

create index if not exists idx_fi_clinical_staffing_templates_tenant_event
  on fi_clinical_staffing_templates (tenant_id, event_type);

create unique index if not exists idx_fi_clinical_staffing_templates_unique_active
  on fi_clinical_staffing_templates (
    tenant_id,
    coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid),
    event_type
  )
  where is_active = true;

alter table fi_clinical_staffing_templates enable row level security;

drop policy if exists fi_clinical_staffing_templates_select_tenant_member on fi_clinical_staffing_templates;
create policy fi_clinical_staffing_templates_select_tenant_member
  on fi_clinical_staffing_templates for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_clinical_staffing_templates.tenant_id
    )
  );

grant select on fi_clinical_staffing_templates to authenticated, service_role;
grant insert, update, delete on fi_clinical_staffing_templates to service_role;

-- ---------------------------------------------------------------------------
-- fi_staff_event_assignments
-- ---------------------------------------------------------------------------

create table if not exists fi_staff_event_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete set null,
  event_source text not null,
  event_id uuid,
  staff_id uuid not null references fi_staff (id) on delete cascade,
  assigned_role text not null,
  assignment_status text not null default 'scheduled',
  readiness_score integer,
  readiness_band text,
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  blocking_issues jsonb not null default '[]'::jsonb,
  assigned_by uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_event_assignments_event_source check (
    event_source in ('booking', 'surgery', 'calendar', 'manual')
  ),
  constraint fi_staff_event_assignments_status check (
    assignment_status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'blocked')
  ),
  constraint fi_staff_event_assignments_eligibility_object check (jsonb_typeof(eligibility_snapshot) = 'object'),
  constraint fi_staff_event_assignments_warnings_array check (jsonb_typeof(warnings) = 'array'),
  constraint fi_staff_event_assignments_blocking_array check (jsonb_typeof(blocking_issues) = 'array')
);

comment on table fi_staff_event_assignments is
  'WorkforceOS: staff assigned to clinical events with readiness snapshot at assignment time.';

create index if not exists idx_fi_staff_event_assignments_tenant
  on fi_staff_event_assignments (tenant_id);

create index if not exists idx_fi_staff_event_assignments_tenant_staff
  on fi_staff_event_assignments (tenant_id, staff_id);

create index if not exists idx_fi_staff_event_assignments_tenant_clinic
  on fi_staff_event_assignments (tenant_id, clinic_id)
  where clinic_id is not null;

create index if not exists idx_fi_staff_event_assignments_tenant_event
  on fi_staff_event_assignments (tenant_id, event_source, event_id);

create index if not exists idx_fi_staff_event_assignments_tenant_status
  on fi_staff_event_assignments (tenant_id, assignment_status);

alter table fi_staff_event_assignments enable row level security;

drop policy if exists fi_staff_event_assignments_select_tenant_member on fi_staff_event_assignments;
create policy fi_staff_event_assignments_select_tenant_member
  on fi_staff_event_assignments for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_event_assignments.tenant_id
    )
  );

grant select on fi_staff_event_assignments to authenticated, service_role;
grant insert, update, delete on fi_staff_event_assignments to service_role;
