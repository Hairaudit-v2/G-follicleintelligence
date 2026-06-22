-- OnboardingOS Phase E2: Deployment Intelligence Command Centre snapshots.
-- RLS: platform admins read all; tenant admins read own tenant; service_role writes only.

-- ---------------------------------------------------------------------------
-- fi_tenant_deployment_intelligence_snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_deployment_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete cascade,
  provisioning_session_id uuid not null references public.fi_tenant_provisioning_sessions (id) on delete cascade,
  deployment_score integer not null default 0,
  deployment_status text not null,
  domain_scores jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_tenant_deployment_intel_score_chk check (
    deployment_score >= 0 and deployment_score <= 100
  ),
  constraint fi_tenant_deployment_intel_status_chk check (
    deployment_status in (
      'early_setup',
      'infrastructure_in_progress',
      'internal_testing',
      'staff_training_active',
      'pilot_ready',
      'production_ready'
    )
  ),
  constraint fi_tenant_deployment_intel_domain_scores_array check (jsonb_typeof(domain_scores) = 'array'),
  constraint fi_tenant_deployment_intel_recommendations_array check (jsonb_typeof(recommendations) = 'array'),
  constraint fi_tenant_deployment_intel_source_object check (jsonb_typeof(source_snapshot) = 'object')
);

comment on table public.fi_tenant_deployment_intelligence_snapshots is
  'OnboardingOS Phase E2: weighted deployment intelligence snapshots (infrastructure, workflow, staff, ops, adoption, executive).';

create index if not exists idx_fi_tenant_deployment_intel_tenant
  on public.fi_tenant_deployment_intelligence_snapshots (tenant_id, calculated_at desc)
  where tenant_id is not null;

create index if not exists idx_fi_tenant_deployment_intel_session
  on public.fi_tenant_deployment_intelligence_snapshots (provisioning_session_id, calculated_at desc);

create index if not exists idx_fi_tenant_deployment_intel_status
  on public.fi_tenant_deployment_intelligence_snapshots (deployment_status, calculated_at desc);

create index if not exists idx_fi_tenant_deployment_intel_calculated_at
  on public.fi_tenant_deployment_intelligence_snapshots (calculated_at desc);

alter table public.fi_tenant_deployment_intelligence_snapshots enable row level security;

drop policy if exists fi_tenant_deployment_intel_select_platform_admin on public.fi_tenant_deployment_intelligence_snapshots;
create policy fi_tenant_deployment_intel_select_platform_admin
  on public.fi_tenant_deployment_intelligence_snapshots for select to authenticated
  using (
    exists (
      select 1 from public.fi_os_identities o
      where o.auth_user_id = auth.uid()
        and o.os_role = 'fi_platform_admin'
    )
  );

drop policy if exists fi_tenant_deployment_intel_select_tenant_admin on public.fi_tenant_deployment_intelligence_snapshots;
create policy fi_tenant_deployment_intel_select_tenant_admin
  on public.fi_tenant_deployment_intelligence_snapshots for select to authenticated
  using (
    tenant_id is not null
    and exists (
      select 1 from public.fi_users u
      join public.fi_tenant_admin_users tau
        on tau.fi_user_id = u.id
        and tau.tenant_id = u.tenant_id
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_tenant_deployment_intelligence_snapshots.tenant_id
        and tau.status = 'active'
        and tau.admin_role in ('clinic_admin', 'operations_admin', 'data_safety_admin')
    )
  );

grant select on public.fi_tenant_deployment_intelligence_snapshots to authenticated, service_role;
grant insert, update, delete on public.fi_tenant_deployment_intelligence_snapshots to service_role;
