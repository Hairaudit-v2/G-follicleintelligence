-- FI-HUBSPOT-IMPORT-1C — operator owner-resolution decisions (persist independently of apply).
-- Additive only. Does not mutate fi_staff / fi_users. Service-role writes; tenant members may read.

create table if not exists public.fi_hubspot_owner_resolution_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  hubspot_owner_id text not null check (char_length(trim(hubspot_owner_id)) > 0),
  resolution_state text not null,
  target_staff_id uuid references public.fi_staff (id) on delete set null,
  match_evidence jsonb not null default '{}'::jsonb,
  operator_fi_user_id uuid references public.fi_users (id) on delete set null,
  operator_note text,
  import_batch_id uuid references public.fi_import_batches (id) on delete set null,
  previous_decision_id uuid references public.fi_hubspot_owner_resolution_decisions (id) on delete set null,
  applied_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hubspot_owner_resolution_decisions_state_chk check (
    resolution_state in (
      'mapped',
      'proposed',
      'unresolved',
      'no_matching_staff',
      'archived_source_owner',
      'historical_only',
      'conflict',
      'excluded',
      'already_applied'
    )
  ),
  constraint fi_hubspot_owner_resolution_decisions_evidence_object check (
    jsonb_typeof(match_evidence) = 'object'
  ),
  constraint fi_hubspot_owner_resolution_decisions_map_requires_staff check (
    (resolution_state in ('proposed', 'mapped', 'already_applied') and target_staff_id is not null)
    or (resolution_state not in ('proposed', 'mapped', 'already_applied'))
  )
);

comment on table public.fi_hubspot_owner_resolution_decisions is
  'FI-HUBSPOT-IMPORT-1C: operator decisions for HubSpot owner → FI staff resolution. Review persists without apply.';

-- One active (non-superseded) decision per owner within a tenant+integration.
create unique index if not exists uq_fi_hubspot_owner_resolution_active
  on public.fi_hubspot_owner_resolution_decisions (tenant_id, integration_id, hubspot_owner_id)
  where superseded_at is null;

create index if not exists idx_fi_hubspot_owner_resolution_tenant_state
  on public.fi_hubspot_owner_resolution_decisions (tenant_id, resolution_state, updated_at desc);

create index if not exists idx_fi_hubspot_owner_resolution_batch
  on public.fi_hubspot_owner_resolution_decisions (import_batch_id)
  where import_batch_id is not null;

alter table public.fi_hubspot_owner_resolution_decisions enable row level security;

revoke all on public.fi_hubspot_owner_resolution_decisions from anon, authenticated;

create policy fi_hubspot_owner_resolution_decisions_select_tenant_member
  on public.fi_hubspot_owner_resolution_decisions for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_hubspot_owner_resolution_decisions.tenant_id
    )
  );

grant select on public.fi_hubspot_owner_resolution_decisions to authenticated, service_role;
grant insert, update, delete on public.fi_hubspot_owner_resolution_decisions to service_role;

drop trigger if exists trg_fi_hubspot_owner_resolution_decisions_updated_at
  on public.fi_hubspot_owner_resolution_decisions;
create trigger trg_fi_hubspot_owner_resolution_decisions_updated_at
  before update on public.fi_hubspot_owner_resolution_decisions
  for each row execute procedure public.fi_onboarding_os_set_updated_at();
