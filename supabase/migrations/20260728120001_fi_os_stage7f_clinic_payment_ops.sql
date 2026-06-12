-- FI OS Stage 7F: clinic payment operations — public pay tokens + reminder cron idempotency (additive).

-- ---------------------------------------------------------------------------
-- fi_payment_requests.public_token (opaque, for /pay/[token])
-- ---------------------------------------------------------------------------
alter table public.fi_payment_requests
  add column if not exists public_token text;

do $$
declare
  r record;
begin
  for r in select id from public.fi_payment_requests where public_token is null loop
    update public.fi_payment_requests
    set public_token = encode(gen_random_bytes(18), 'hex')
    where id = r.id;
  end loop;
end $$;

alter table public.fi_payment_requests
  alter column public_token set not null;

create unique index if not exists uq_fi_payment_requests_public_token
  on public.fi_payment_requests (public_token);

comment on column public.fi_payment_requests.public_token is
  'Opaque token for the public /pay/[token] page (no tenant auth). Create a new payment request to rotate.';

-- ---------------------------------------------------------------------------
-- fi_revenue_reminder_runs (cron idempotency: invoice + reminder_key + date)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_revenue_reminder_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  invoice_id uuid not null references public.fi_invoices (id) on delete cascade,
  reminder_key text not null,
  run_date date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_revenue_reminder_runs_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint uq_fi_revenue_reminder_runs_identity unique (tenant_id, invoice_id, reminder_key, run_date)
);

comment on table public.fi_revenue_reminder_runs is
  'FI OS Stage 7F: idempotency ledger for revenue payment reminder cron (CRM/metadata only until outbound senders are wired).';

create index if not exists idx_fi_revenue_reminder_runs_tenant_run
  on public.fi_revenue_reminder_runs (tenant_id, run_date desc);

alter table public.fi_revenue_reminder_runs enable row level security;

revoke all on public.fi_revenue_reminder_runs from authenticated;

grant select, insert, update, delete on public.fi_revenue_reminder_runs to service_role;

drop trigger if exists trg_fi_revenue_reminder_runs_set_updated_at on public.fi_revenue_reminder_runs;
