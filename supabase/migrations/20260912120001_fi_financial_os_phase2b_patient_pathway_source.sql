-- FinancialOS Phase 2B (additive): patient public-token pathway selection source tracking.

alter table public.fi_payment_pathways
  add column if not exists source text not null default 'staff'
    check (source in ('staff', 'patient_public_token', 'system'));

alter table public.fi_payment_pathways
  add column if not exists source_payment_request_id uuid
    references public.fi_payment_requests (id) on delete set null;

comment on column public.fi_payment_pathways.source is
  'How the pathway was created: staff (admin UI), patient_public_token (/pay link), or system.';

comment on column public.fi_payment_pathways.source_payment_request_id is
  'When source = patient_public_token, the fi_payment_requests row whose public_token was used.';

create index if not exists idx_fi_payment_pathways_source
  on public.fi_payment_pathways (source);

create index if not exists idx_fi_payment_pathways_source_payment_request
  on public.fi_payment_pathways (source_payment_request_id)
  where source_payment_request_id is not null;
