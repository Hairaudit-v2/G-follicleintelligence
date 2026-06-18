-- Revenue Intelligence: parallel pipeline layer synced from HubSpot deals.
-- Does NOT modify fi_crm_quotes or other CRM quote records — intelligence-only.

create table if not exists public.fi_revenue_pipeline (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid references public.fi_patients (id) on delete set null,
  crm_lead_id uuid references public.fi_crm_leads (id) on delete set null,
  hubspot_deal_id text not null,
  expected_revenue numeric,
  deposit_amount numeric,
  balance_amount numeric,
  stage text not null
    check (stage in (
      'appointment_scheduled',
      'consult_completed',
      'quote_sent',
      'deposit_pending',
      'deposit_paid',
      'surgery_booked',
      'won',
      'lost'
    )),
  probability_score numeric(5, 2) not null default 0
    check (probability_score >= 0 and probability_score <= 100),
  procedure_type text,
  forecast_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_revenue_pipeline_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_revenue_pipeline_hubspot_deal_nonempty check (char_length(trim(hubspot_deal_id)) > 0)
);

comment on table public.fi_revenue_pipeline is
  'Revenue Intelligence: HubSpot deal mirror for forecasting. Parallel to fi_crm_quotes — never overwrites quote records.';

create unique index if not exists uq_fi_revenue_pipeline_tenant_hubspot_deal
  on public.fi_revenue_pipeline (tenant_id, hubspot_deal_id);

create index if not exists idx_fi_revenue_pipeline_tenant_patient
  on public.fi_revenue_pipeline (tenant_id, patient_id)
  where patient_id is not null;

create index if not exists idx_fi_revenue_pipeline_tenant_stage
  on public.fi_revenue_pipeline (tenant_id, stage);

create index if not exists idx_fi_revenue_pipeline_tenant_forecast
  on public.fi_revenue_pipeline (tenant_id, forecast_date)
  where forecast_date is not null;

alter table public.fi_revenue_pipeline enable row level security;

drop policy if exists fi_revenue_pipeline_select_tenant_member on public.fi_revenue_pipeline;
create policy fi_revenue_pipeline_select_tenant_member
  on public.fi_revenue_pipeline for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_revenue_pipeline.tenant_id
    )
  );

grant select on public.fi_revenue_pipeline to authenticated, service_role;
grant insert, update, delete on public.fi_revenue_pipeline to service_role;

create or replace function public.fi_revenue_pipeline_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_revenue_pipeline_set_updated_at on public.fi_revenue_pipeline;
create trigger trg_fi_revenue_pipeline_set_updated_at
  before update on public.fi_revenue_pipeline
  for each row
  execute procedure public.fi_revenue_pipeline_set_updated_at();
