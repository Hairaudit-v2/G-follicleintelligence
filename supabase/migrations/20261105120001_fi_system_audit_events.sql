-- FI OS Phase 1 — System Audit Trail (append-only, tenant-scoped).
-- Table: public.fi_system_audit_events (logical product name: audit_events).
-- Application code must only INSERT via emitAuditEvent(); no UPDATE/DELETE grants.

create table if not exists public.fi_system_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid null,
  actor_role text null,
  actor_type text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  parent_entity_type text null,
  parent_entity_id uuid null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet null,
  user_agent text null,
  session_id text null,
  source text not null default 'fi_os',
  created_at timestamptz not null default now(),
  constraint fi_system_audit_events_actor_type_chk check (
    actor_type in ('staff', 'patient', 'system', 'integration')
  ),
  constraint fi_system_audit_events_action_nonempty check (char_length(trim(action)) > 0),
  constraint fi_system_audit_events_entity_type_nonempty check (char_length(trim(entity_type)) > 0),
  constraint fi_system_audit_events_summary_nonempty check (char_length(trim(summary)) > 0),
  constraint fi_system_audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_system_audit_events is
  'FI OS Phase 1 system audit trail: append-only who/what/when for clinical, financial, and operational events. Product name: audit_events.';

comment on column public.fi_system_audit_events.actor_type is
  'staff | patient | system | integration';

comment on column public.fi_system_audit_events.action is
  'Stable action code e.g. patient.created, payment.recorded, lead.approved';

create index if not exists idx_fi_system_audit_tenant_occurred
  on public.fi_system_audit_events (tenant_id, occurred_at desc);

create index if not exists idx_fi_system_audit_tenant_entity
  on public.fi_system_audit_events (tenant_id, entity_type, entity_id);

create index if not exists idx_fi_system_audit_tenant_actor_occurred
  on public.fi_system_audit_events (tenant_id, actor_user_id, occurred_at desc);

create index if not exists idx_fi_system_audit_tenant_parent
  on public.fi_system_audit_events (tenant_id, parent_entity_type, parent_entity_id);

-- Append-only: service role insert + select only; no update/delete grants.
alter table public.fi_system_audit_events enable row level security;

revoke all on public.fi_system_audit_events from public;
revoke all on public.fi_system_audit_events from anon;
revoke all on public.fi_system_audit_events from authenticated;

grant select, insert on public.fi_system_audit_events to service_role;

-- Tenant members (manager/admin/auditor enforced in app) may select own tenant via policy when using user JWT.
-- Phase 1 loaders use service_role server-side; policy is defensive for future client reads.
drop policy if exists fi_system_audit_events_select_tenant_member on public.fi_system_audit_events;
create policy fi_system_audit_events_select_tenant_member
  on public.fi_system_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_system_audit_events.tenant_id
    )
  );

-- No insert policy for authenticated — inserts only via service_role helper.
-- No update/delete policies — append-only.
