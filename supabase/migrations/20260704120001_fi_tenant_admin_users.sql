-- Tenant-scoped backend / clinic admin users (not clinical staff; no fi_staff required).
-- Access is enforced in Next.js via service role; no authenticated RLS policies.

create table if not exists fi_tenant_admin_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  fi_user_id uuid not null references fi_users (id) on delete cascade,
  admin_role text not null,
  status text not null default 'invited',
  display_name text,
  access_notes text,
  invited_by_fi_user_id uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_admin_users_role_chk check (
    admin_role in (
      'clinic_admin',
      'finance_admin',
      'operations_admin',
      'dashboard_viewer',
      'data_safety_admin'
    )
  ),
  constraint fi_tenant_admin_users_status_chk check (status in ('invited', 'active', 'suspended')),
  constraint fi_tenant_admin_users_tenant_fi_user_unique unique (tenant_id, fi_user_id)
);

comment on table fi_tenant_admin_users is
  'Non-clinical tenant admin access: roles and lifecycle separate from fi_staff / HR employment.';

create index if not exists idx_fi_tenant_admin_users_tenant on fi_tenant_admin_users (tenant_id);
create index if not exists idx_fi_tenant_admin_users_fi_user on fi_tenant_admin_users (fi_user_id);

alter table fi_tenant_admin_users enable row level security;

grant select, insert, update, delete on fi_tenant_admin_users to service_role;

-- Append-only audit trail for admin user lifecycle (server-side inserts only).
create table if not exists fi_tenant_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  event_kind text not null,
  actor_fi_user_id uuid references fi_users (id) on delete set null,
  subject_admin_user_id uuid references fi_tenant_admin_users (id) on delete set null,
  subject_fi_user_id uuid references fi_users (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_tenant_admin_audit_events_kind_chk check (
    event_kind in (
      'admin_user.invited',
      'admin_user.role_changed',
      'admin_user.suspended',
      'admin_user.reactivated'
    )
  ),
  constraint fi_tenant_admin_audit_events_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table fi_tenant_admin_audit_events is
  'Audit events for fi_tenant_admin_users (invites, role changes, suspend/reactivate).';

create index if not exists idx_fi_tenant_admin_audit_tenant_created
  on fi_tenant_admin_audit_events (tenant_id, created_at desc);

alter table fi_tenant_admin_audit_events enable row level security;

grant select, insert on fi_tenant_admin_audit_events to service_role;

-- Server-only helper: resolve auth.users.id by email (invite flow when user already exists).
create or replace function public.fi_admin_lookup_auth_user_id_by_email(_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id from auth.users where lower(trim(email)) = lower(trim(_email)) limit 1;
$$;

revoke all on function public.fi_admin_lookup_auth_user_id_by_email(text) from public;
grant execute on function public.fi_admin_lookup_auth_user_id_by_email(text) to service_role;

comment on function public.fi_admin_lookup_auth_user_id_by_email(text) is
  'Service-role only: lookup auth.users id for tenant admin invite linking. Not granted to anon/authenticated.';
