-- FinancialOS Phase 2B — cost model versioning metadata for admin UI.

alter table public.fi_surgery_cost_models
  add column if not exists created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  add column if not exists archived_at timestamptz;

comment on column public.fi_surgery_cost_models.created_by_fi_user_id is
  'FI user who created this cost model version.';
comment on column public.fi_surgery_cost_models.archived_at is
  'When this cost model version was archived (is_active = false).';

create index if not exists idx_fi_surgery_cost_models_tenant_archived
  on public.fi_surgery_cost_models (tenant_id, archived_at desc nulls first);
