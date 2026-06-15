-- Per-tenant machine ingest: HMAC key material (encrypted at rest by app), nonce replay tracking, audit trail.
-- Access: Next.js service role only (no tenant RLS reads; keys are sensitive).

create table if not exists public.fi_machine_ingest_hmac_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  kid text not null,
  secret_encrypted text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (tenant_id, kid)
);

comment on table public.fi_machine_ingest_hmac_keys is
  'HMAC secrets for signed machine ingest; ciphertext produced by app using FI_MACHINE_INGEST_MASTER_KEY (AES-256-GCM).';

create index if not exists idx_fi_machine_ingest_hmac_keys_tenant
  on public.fi_machine_ingest_hmac_keys (tenant_id)
  where revoked_at is null;

create table if not exists public.fi_machine_ingest_nonce (
  tenant_id uuid not null,
  kid text not null,
  nonce text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, kid, nonce)
);

comment on table public.fi_machine_ingest_nonce is
  'Replay protection for machine ingest; rows may be purged after expires_at.';

create index if not exists idx_fi_machine_ingest_nonce_expires
  on public.fi_machine_ingest_nonce (expires_at);

create table if not exists public.fi_machine_ingest_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  kid text,
  route text not null,
  outcome text not null,
  reason_code text,
  http_status int,
  body_sha256 text,
  created_at timestamptz not null default now(),
  constraint fi_machine_ingest_audit_outcome_check check (outcome in ('accepted', 'rejected'))
);

comment on table public.fi_machine_ingest_audit is
  'Accept/reject audit for machine-signed requests; no raw body or PHI.';

create index if not exists idx_fi_machine_ingest_audit_tenant_created
  on public.fi_machine_ingest_audit (tenant_id, created_at desc);

alter table public.fi_machine_ingest_hmac_keys enable row level security;
alter table public.fi_machine_ingest_nonce enable row level security;
alter table public.fi_machine_ingest_audit enable row level security;

revoke all on public.fi_machine_ingest_hmac_keys from public;
revoke all on public.fi_machine_ingest_nonce from public;
revoke all on public.fi_machine_ingest_audit from public;

grant select, insert, update, delete on public.fi_machine_ingest_hmac_keys to service_role;
grant select, insert, update, delete on public.fi_machine_ingest_nonce to service_role;
grant select, insert, update, delete on public.fi_machine_ingest_audit to service_role;
