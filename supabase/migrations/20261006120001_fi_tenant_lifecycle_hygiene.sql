-- FI-PROD-TENANT-HYGIENE-1: archive-first tenant lifecycle (no hard deletes).

alter table public.fi_tenants
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists archive_reason text,
  add column if not exists is_demo boolean not null default false,
  add column if not exists is_production_visible boolean not null default true;

comment on column public.fi_tenants.archived_at is
  'When set, tenant is archived (hidden from default admin lists; data retained).';
comment on column public.fi_tenants.archived_by is
  'auth.users.id of the platform admin who archived the tenant.';
comment on column public.fi_tenants.archive_reason is
  'Human-readable reason supplied at archive time.';
comment on column public.fi_tenants.is_demo is
  'Demo / sandbox tenant — shown in a separate admin group by default.';
comment on column public.fi_tenants.is_production_visible is
  'When false, hidden from default production tenant directory (demo/sandbox hygiene).';

create index if not exists idx_fi_tenants_archived_at
  on public.fi_tenants (archived_at desc nulls first);

create index if not exists idx_fi_tenants_is_demo
  on public.fi_tenants (is_demo)
  where is_demo = true;

-- Platform-level tenant lifecycle audit (archive / restore).
create table if not exists public.fi_platform_tenant_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  event_kind text not null,
  actor_auth_user_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_platform_tenant_audit_events_kind_chk check (
    event_kind in ('tenant.archived', 'tenant.restored', 'tenant.demo_marked')
  ),
  constraint fi_platform_tenant_audit_events_detail_object check (jsonb_typeof (detail) = 'object')
);

comment on table public.fi_platform_tenant_audit_events is
  'Append-only audit for platform-admin tenant archive/restore lifecycle actions.';

create index if not exists idx_fi_platform_tenant_audit_tenant_created
  on public.fi_platform_tenant_audit_events (tenant_id, created_at desc);

alter table public.fi_platform_tenant_audit_events enable row level security;

grant select, insert on public.fi_platform_tenant_audit_events to service_role;

-- Production hygiene defaults (idempotent; no deletes).
update public.fi_tenants
set
  is_demo = true,
  is_production_visible = false,
  updated_at = now()
where slug in ('acme-demo', 'ihrg-global')
  and archived_at is null
  and (is_demo is distinct from true or is_production_visible is distinct from false);

-- Active production tenant stays visible; never auto-archive.
update public.fi_tenants
set
  is_demo = false,
  is_production_visible = true,
  updated_at = now()
where slug = 'evolved-hair'
  and archived_at is null;
