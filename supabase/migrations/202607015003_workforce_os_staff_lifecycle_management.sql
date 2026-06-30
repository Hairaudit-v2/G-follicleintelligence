-- WorkforceOS Phase 1C: staff lifecycle management — employment status, archival, identity source, audit.

-- Bridge fi_staff (operational SOR) to fi_staff_members (WorkforceOS projection).
alter table public.fi_staff_members
  add column if not exists fi_staff_id uuid references public.fi_staff (id) on delete set null;

create unique index if not exists idx_fi_staff_members_tenant_fi_staff_unique
  on public.fi_staff_members (tenant_id, fi_staff_id)
  where fi_staff_id is not null and archived_at is null;

-- Lifecycle columns on fi_staff_members (WorkforceOS projection).
alter table public.fi_staff_members
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists professional_title text,
  add column if not exists phone text,
  add column if not exists role_code text,
  add column if not exists employment_type text,
  add column if not exists employment_status text not null default 'active',
  add column if not exists timezone text,
  add column if not exists clinic_id uuid,
  add column if not exists notes text,
  add column if not exists identity_source text not null default 'local',
  add column if not exists employment_status_reason text,
  add column if not exists employment_status_changed_at timestamptz,
  add column if not exists employment_status_changed_by uuid,
  add column if not exists last_manual_profile_update timestamptz,
  add column if not exists internal_tags jsonb not null default '[]'::jsonb;

alter table public.fi_staff_members
  drop constraint if exists fi_staff_members_employment_status_chk;

alter table public.fi_staff_members
  add constraint fi_staff_members_employment_status_chk check (
    employment_status in (
      'active',
      'inactive',
      'on_leave',
      'pending_onboarding',
      'terminated',
      'resigned',
      'contract_ended',
      'suspended'
    )
  );

alter table public.fi_staff_members
  drop constraint if exists fi_staff_members_identity_source_chk;

alter table public.fi_staff_members
  add constraint fi_staff_members_identity_source_chk check (
    identity_source in (
      'local',
      'iiohr_evolved_hr',
      'academy_sync',
      'manual_import',
      'future_external_system'
    )
  );

alter table public.fi_staff_members
  drop constraint if exists fi_staff_members_internal_tags_array;

alter table public.fi_staff_members
  add constraint fi_staff_members_internal_tags_array check (jsonb_typeof(internal_tags) = 'array');

create index if not exists idx_fi_staff_members_tenant_employment_status
  on public.fi_staff_members (tenant_id, employment_status)
  where archived_at is null;

create index if not exists idx_fi_staff_members_tenant_identity_source
  on public.fi_staff_members (tenant_id, identity_source);

-- Operational lifecycle columns on fi_staff (scheduling / readiness integration).
alter table public.fi_staff
  add column if not exists professional_title text,
  add column if not exists employment_status text not null default 'active',
  add column if not exists identity_source text not null default 'local',
  add column if not exists employment_status_reason text,
  add column if not exists employment_status_changed_at timestamptz,
  add column if not exists employment_status_changed_by uuid,
  add column if not exists last_manual_profile_update timestamptz,
  add column if not exists archived_at timestamptz;

alter table public.fi_staff
  drop constraint if exists fi_staff_employment_status_chk;

alter table public.fi_staff
  add constraint fi_staff_employment_status_chk check (
    employment_status in (
      'active',
      'inactive',
      'on_leave',
      'pending_onboarding',
      'terminated',
      'resigned',
      'contract_ended',
      'suspended'
    )
  );

alter table public.fi_staff
  drop constraint if exists fi_staff_identity_source_chk;

alter table public.fi_staff
  add constraint fi_staff_identity_source_chk check (
    identity_source in (
      'local',
      'iiohr_evolved_hr',
      'academy_sync',
      'manual_import',
      'future_external_system'
    )
  );

create index if not exists idx_fi_staff_tenant_employment_status
  on public.fi_staff (tenant_id, employment_status)
  where archived_at is null;

-- Expand audit event types for lifecycle governance.
alter table public.fi_staff_member_audit_events
  drop constraint if exists fi_staff_member_audit_events_event_type_chk;

alter table public.fi_staff_member_audit_events
  add constraint fi_staff_member_audit_events_event_type_chk check (
    event_type in (
      'staff_synced_from_iiohr',
      'staff_sync_updated_from_iiohr',
      'staff_profile_updated',
      'staff_archived',
      'staff_restored',
      'staff_employment_status_changed',
      'staff_hr_reconciled',
      'staff_hr_linked_manually',
      'staff_hr_link_removed'
    )
  );

comment on column public.fi_staff_members.fi_staff_id is
  'Optional link to operational fi_staff row — lifecycle ops sync both sides.';

comment on column public.fi_staff.employment_status is
  'WorkforceOS employment lifecycle state — never hard-delete staff; use archival instead.';

comment on column public.fi_staff.archived_at is
  'When set, staff is hidden from default directory but history is retained.';
