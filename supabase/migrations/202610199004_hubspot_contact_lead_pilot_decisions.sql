-- FI-HUBSPOT-IMPORT-1D: operator decisions for HubSpot contact → FI lead pilot.
-- Patient creation remains forbidden; apply is batch-scoped and additive-first.

create table if not exists public.fi_hubspot_contact_lead_pilot_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  hubspot_contact_id text not null check (char_length(trim(hubspot_contact_id)) > 0),
  decision_state text not null,
  target_lead_id uuid references public.fi_crm_leads (id) on delete set null,
  match_evidence jsonb not null default '{}'::jsonb,
  approved_for_apply boolean not null default false,
  operator_fi_user_id uuid references public.fi_users (id) on delete set null,
  operator_note text,
  import_batch_id uuid references public.fi_import_batches (id) on delete set null,
  previous_decision_id uuid references public.fi_hubspot_contact_lead_pilot_decisions (id) on delete set null,
  applied_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hubspot_contact_lead_pilot_decisions_state_chk check (
    decision_state in (
      'link_existing_lead',
      'create_new_lead',
      'already_linked',
      'patient_link_review_required',
      'quarantine_missing_identity',
      'quarantine_ambiguous_identity',
      'quarantine_multi_target_conflict',
      'quarantine_unmapped_owner',
      'quarantine_unmapped_stage',
      'quarantine_test_or_smoke',
      'wrong_tenant',
      'excluded',
      'already_applied'
    )
  ),
  constraint fi_hubspot_contact_lead_pilot_decisions_evidence_object check (
    jsonb_typeof(match_evidence) = 'object'
  )
);

comment on table public.fi_hubspot_contact_lead_pilot_decisions is
  'FI-HUBSPOT-IMPORT-1D: operator decisions for HubSpot contact → FI lead pilot. Review persists without apply.';

create unique index if not exists uq_fi_hubspot_contact_lead_pilot_active
  on public.fi_hubspot_contact_lead_pilot_decisions (tenant_id, integration_id, hubspot_contact_id)
  where superseded_at is null;

create index if not exists idx_fi_hubspot_contact_lead_pilot_tenant_state
  on public.fi_hubspot_contact_lead_pilot_decisions (tenant_id, decision_state, updated_at desc);

alter table public.fi_hubspot_contact_lead_pilot_decisions enable row level security;

revoke all on public.fi_hubspot_contact_lead_pilot_decisions from anon, authenticated;

create policy fi_hubspot_contact_lead_pilot_decisions_select_tenant_member
  on public.fi_hubspot_contact_lead_pilot_decisions for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_hubspot_contact_lead_pilot_decisions.tenant_id
    )
  );

grant select on public.fi_hubspot_contact_lead_pilot_decisions to authenticated, service_role;
grant insert, update, delete on public.fi_hubspot_contact_lead_pilot_decisions to service_role;

drop trigger if exists trg_fi_hubspot_contact_lead_pilot_decisions_updated_at
  on public.fi_hubspot_contact_lead_pilot_decisions;
create trigger trg_fi_hubspot_contact_lead_pilot_decisions_updated_at
  before update on public.fi_hubspot_contact_lead_pilot_decisions
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- Rollback of additive 1D mappings requires service-role delete.
grant delete on public.fi_external_record_mappings to service_role;
