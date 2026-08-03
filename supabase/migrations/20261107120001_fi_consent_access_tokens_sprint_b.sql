-- FI OS Consent Framework — Sprint B
-- Patient e-sign access tokens (hash-only at rest; service role resolve/sign).

create table if not exists public.fi_consent_access_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  instance_id uuid not null references public.fi_patient_consent_instances (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint fi_consent_access_tokens_token_hash_unique unique (token_hash),
  constraint fi_consent_access_tokens_token_hash_nonempty check (char_length(trim(token_hash)) > 0),
  constraint fi_consent_access_tokens_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_consent_access_tokens is
  'Opaque patient consent e-sign links. DB stores SHA-256 hash only; raw token lives in the URL.';

comment on column public.fi_consent_access_tokens.token_hash is
  'SHA-256 hex of raw token. Never store raw token.';

comment on column public.fi_consent_access_tokens.used_at is
  'Set on successful sign. Token remains resolvable until used or expires_at (prefer valid until signed/expiry).';

create index if not exists idx_fi_consent_access_tokens_tenant_patient
  on public.fi_consent_access_tokens (tenant_id, patient_id);

create index if not exists idx_fi_consent_access_tokens_instance
  on public.fi_consent_access_tokens (tenant_id, instance_id);

create index if not exists idx_fi_consent_access_tokens_expires
  on public.fi_consent_access_tokens (expires_at);

alter table public.fi_consent_access_tokens enable row level security;

-- No general member SELECT: resolve/sign only via service role server paths.
-- Explicit deny-style: no policies for authenticated → only service_role can read/write.
drop policy if exists fi_consent_access_tokens_select_none on public.fi_consent_access_tokens;

grant select, insert, update, delete on public.fi_consent_access_tokens to service_role;
-- authenticated: no grants (default revoke for new table in public schema may still allow via defaults — revoke explicitly)
revoke all on public.fi_consent_access_tokens from authenticated;
revoke all on public.fi_consent_access_tokens from anon;
