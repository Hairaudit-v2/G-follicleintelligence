-- WorkforceOS: IIOHR HR link columns on fi_staff_members + reconciliation audit trail.

create table if not exists public.fi_staff_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  full_name text not null,
  email text,
  archived_at timestamptz,
  iiohr_staff_record_id uuid,
  iiohr_user_id uuid,
  source_system text,
  source_synced_at timestamptz,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_members_source_snapshot_object check (jsonb_typeof(source_snapshot) = 'object')
);

comment on table public.fi_staff_members is
  'WorkforceOS staff directory projection. Manual rows may be linked to IIOHR Evolved HR via email reconciliation.';

create index if not exists idx_fi_staff_members_tenant
  on public.fi_staff_members (tenant_id);

create index if not exists idx_fi_staff_members_tenant_iiohr_staff_record
  on public.fi_staff_members (tenant_id, iiohr_staff_record_id)
  where archived_at is null and iiohr_staff_record_id is not null;

create index if not exists idx_fi_staff_members_tenant_source_system
  on public.fi_staff_members (tenant_id, source_system);

create index if not exists idx_fi_staff_members_source_synced_at
  on public.fi_staff_members (source_synced_at desc);

create unique index if not exists idx_fi_staff_members_tenant_iiohr_staff_record_unique
  on public.fi_staff_members (tenant_id, iiohr_staff_record_id)
  where archived_at is null and iiohr_staff_record_id is not null;

alter table public.fi_staff_members enable row level security;

-- Tenant-member read policy only when platform users table is present (foundation migration).
do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_staff_members_select_tenant_member on public.fi_staff_members;
    create policy fi_staff_members_select_tenant_member
      on public.fi_staff_members for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_staff_members.tenant_id
        )
      );
    grant select on public.fi_staff_members to authenticated;
  end if;
end $$;

grant select on public.fi_staff_members to service_role;
grant insert, update, delete on public.fi_staff_members to service_role;

create table if not exists public.fi_staff_member_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  event_type text not null,
  source text not null default 'iiohr_hr_staff_reconciliation',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_staff_member_audit_events_event_type_chk check (
    event_type in (
      'staff_synced_from_iiohr',
      'staff_sync_updated_from_iiohr'
    )
  ),
  constraint fi_staff_member_audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_staff_member_audit_events is
  'WorkforceOS append-only audit for IIOHR HR staff link and sync events.';

create index if not exists idx_fi_staff_member_audit_tenant_staff
  on public.fi_staff_member_audit_events (tenant_id, staff_member_id, created_at desc);

create index if not exists idx_fi_staff_member_audit_tenant_event_type
  on public.fi_staff_member_audit_events (tenant_id, event_type);

alter table public.fi_staff_member_audit_events enable row level security;

grant select, insert on public.fi_staff_member_audit_events to service_role;
