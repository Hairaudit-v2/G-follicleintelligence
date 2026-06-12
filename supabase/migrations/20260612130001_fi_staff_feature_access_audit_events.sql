-- FI OS Stage 4: append-only audit for staff feature/workspace/position and tenant operating mode changes.

create table if not exists public.fi_staff_feature_access_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_id uuid references public.fi_staff (id) on delete set null,
  actor_user_id uuid,
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  event_type text not null,
  target_type text not null,
  feature_key text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  source text not null default 'fi_os_admin',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_staff_feature_access_audit_events_event_type_chk check (
    event_type in (
      'feature_override_changed',
      'workspace_profile_changed',
      'position_type_changed',
      'tenant_operating_mode_changed'
    )
  ),
  constraint fi_staff_feature_access_audit_events_target_type_chk check (target_type in ('staff', 'tenant')),
  constraint fi_staff_feature_access_audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_staff_feature_access_audit_events is
  'FI OS Stage 4: governance audit for feature overrides, workspace profile, position type, and tenant operating mode.';

create index if not exists idx_fi_staff_feature_access_audit_tenant_staff
  on public.fi_staff_feature_access_audit_events (tenant_id, staff_id);

create index if not exists idx_fi_staff_feature_access_audit_tenant_actor_fi_user
  on public.fi_staff_feature_access_audit_events (tenant_id, actor_fi_user_id);

create index if not exists idx_fi_staff_feature_access_audit_tenant_event_type
  on public.fi_staff_feature_access_audit_events (tenant_id, event_type);

create index if not exists idx_fi_staff_feature_access_audit_created_at
  on public.fi_staff_feature_access_audit_events (created_at desc);

alter table public.fi_staff_feature_access_audit_events enable row level security;

grant select, insert, update, delete on public.fi_staff_feature_access_audit_events to service_role;

-- Authenticated read for tenant admins / cross-tenant OS operators (fi_os_identities not otherwise visible under RLS).
create or replace function public.fi_os_can_select_staff_feature_access_audit(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.fi_users u
      join public.fi_tenant_admin_users tau
        on tau.fi_user_id = u.id
       and tau.tenant_id = p_tenant_id
      where u.auth_user_id = auth.uid()
        and lower(trim(tau.status)) = 'active'
    )
    or exists (
      select 1
      from public.fi_os_identities o
      where o.auth_user_id = auth.uid()
        and lower(trim(o.os_role)) in ('fi_platform_admin', 'fi_admin', 'fi_auditor')
    );
$$;

revoke all on function public.fi_os_can_select_staff_feature_access_audit(uuid) from public;
grant execute on function public.fi_os_can_select_staff_feature_access_audit(uuid) to authenticated;

drop policy if exists fi_staff_feature_access_audit_select_privileged on public.fi_staff_feature_access_audit_events;
create policy fi_staff_feature_access_audit_select_privileged
  on public.fi_staff_feature_access_audit_events
  for select
  to authenticated
  using (public.fi_os_can_select_staff_feature_access_audit(tenant_id));

grant select on public.fi_staff_feature_access_audit_events to authenticated;
