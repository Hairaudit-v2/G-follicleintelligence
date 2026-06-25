-- LeadFlowOS Phase LF-3 — lead intelligence scoring columns on fi_leads (additive, backend-only).
-- Deterministic scoring fields populated by HubSpot upsert pipeline; RLS unchanged (tenant SELECT, service_role DML).

alter table public.fi_leads
  add column if not exists priority_band text,
  add column if not exists predicted_procedure text,
  add column if not exists scoring_reasons jsonb not null default '[]'::jsonb,
  add column if not exists risk_flags jsonb not null default '[]'::jsonb,
  add column if not exists scored_at timestamptz;

comment on column public.fi_leads.priority_band is
  'LeadFlowOS LF-3: deterministic priority band (low | medium | high | urgent) from lead scoring engine.';

comment on column public.fi_leads.predicted_procedure is
  'LeadFlowOS LF-3: predicted procedure intent from scoring engine.';

comment on column public.fi_leads.scoring_reasons is
  'LeadFlowOS LF-3: explainable scoring reasons (json array of strings).';

comment on column public.fi_leads.risk_flags is
  'LeadFlowOS LF-3: deterministic risk flags (json array of strings).';

comment on column public.fi_leads.scored_at is
  'LeadFlowOS LF-3: timestamp of last deterministic score calculation.';

alter table public.fi_leads
  drop constraint if exists fi_leads_priority_band_chk;

alter table public.fi_leads
  add constraint fi_leads_priority_band_chk check (
    priority_band is null
    or priority_band in ('low', 'medium', 'high', 'urgent')
  );

alter table public.fi_leads
  drop constraint if exists fi_leads_predicted_procedure_chk;

alter table public.fi_leads
  add constraint fi_leads_predicted_procedure_chk check (
    predicted_procedure is null
    or predicted_procedure in (
      'fue_transplant',
      'prp',
      'exosomes',
      'repair_case',
      'consultation_only',
      'unknown'
    )
  );

alter table public.fi_leads
  drop constraint if exists fi_leads_scoring_reasons_array;

alter table public.fi_leads
  add constraint fi_leads_scoring_reasons_array check (jsonb_typeof (scoring_reasons) = 'array');

alter table public.fi_leads
  drop constraint if exists fi_leads_risk_flags_array;

alter table public.fi_leads
  add constraint fi_leads_risk_flags_array check (jsonb_typeof (risk_flags) = 'array');

create index if not exists idx_fi_leads_tenant_priority_band
  on public.fi_leads (tenant_id, priority_band)
  where priority_band is not null;

create index if not exists idx_fi_leads_tenant_predicted_procedure
  on public.fi_leads (tenant_id, predicted_procedure)
  where predicted_procedure is not null;
