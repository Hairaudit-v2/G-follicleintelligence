-- FI-TRICHOSCOPY-1A entitlement addendum: generic per-module entitlement projection,
-- configuration, usage metering, and time-bounded overrides. Seed hli_trichoscopy.
-- RLS: service_role DML only — access checks run in Next.js via supabaseAdmin.

-- ---------------------------------------------------------------------------
-- Seed hli_trichoscopy module catalog entry
-- ---------------------------------------------------------------------------
insert into public.fi_modules (code, display_name, description, default_allowed_roles, sort_order)
values (
  'hli_trichoscopy',
  'Trichoscopy Intelligence',
  'HLI trichoscopy request, capture, review, and confirmed evidence workflows.',
  array['admin', 'fi_admin', 'owner', 'tenant_backend', 'consultant', 'doctor', 'nurse']::text[],
  110
)
on conflict (code) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  default_allowed_roles = excluded.default_allowed_roles,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- fi_tenant_module_entitlements — local subscription projection per module
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_module_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  module_key text not null,
  status text not null default 'not_entitled',
  subscription_plan_id uuid references public.fi_subscription_plans (id) on delete set null,
  subscription_id text,
  price_id text,
  capability_tier text not null default 'capture',
  enabled_capabilities text[] not null default '{}'::text[],
  starts_at timestamptz,
  trial_ends_at timestamptz,
  grace_period_ends_at timestamptz,
  expires_at timestamptz,
  source text not null default 'subscription',
  granted_by uuid references public.fi_users (id) on delete set null,
  granted_at timestamptz,
  revoked_by uuid references public.fi_users (id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_module_entitlements_tenant_module_unique unique (tenant_id, module_key),
  constraint fi_tenant_module_entitlements_module_key_nonempty check (char_length(trim(module_key)) > 0),
  constraint fi_tenant_module_entitlements_status_chk check (
    status in (
      'active',
      'trial',
      'grace_period',
      'expired',
      'suspended',
      'cancelled',
      'not_entitled'
    )
  ),
  constraint fi_tenant_module_entitlements_tier_chk check (
    capability_tier in ('capture', 'clinical', 'longitudinal', 'surgical', 'complete')
  ),
  constraint fi_tenant_module_entitlements_source_chk check (
    source in ('subscription', 'manual_grant', 'trial', 'partner', 'legacy')
  ),
  constraint fi_tenant_module_entitlements_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_tenant_module_entitlements_revocation_reason_len check (
    revocation_reason is null or char_length(revocation_reason) <= 2000
  )
);

comment on table public.fi_tenant_module_entitlements is
  'Per-tenant module entitlement projection (billing source of truth mirrored locally). Service-role only.';

create index if not exists idx_fi_tenant_module_entitlements_tenant_status
  on public.fi_tenant_module_entitlements (tenant_id, status);

create index if not exists idx_fi_tenant_module_entitlements_module_status
  on public.fi_tenant_module_entitlements (module_key, status);

-- ---------------------------------------------------------------------------
-- fi_tenant_module_configurations — operational enablement (distinct from paid entitlement)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_module_configurations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  module_key text not null,
  enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  enabled_at timestamptz,
  enabled_by uuid references public.fi_users (id) on delete set null,
  disabled_at timestamptz,
  disabled_by uuid references public.fi_users (id) on delete set null,
  disable_reason text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_tenant_module_configurations_tenant_module_unique unique (tenant_id, module_key),
  constraint fi_tenant_module_configurations_module_key_nonempty check (char_length(trim(module_key)) > 0),
  constraint fi_tenant_module_configurations_settings_object check (jsonb_typeof(settings) = 'object'),
  constraint fi_tenant_module_configurations_disable_reason_len check (
    disable_reason is null or char_length(disable_reason) <= 2000
  )
);

comment on table public.fi_tenant_module_configurations is
  'Per-tenant operational module configuration. Cannot enable capabilities absent from entitlement.';

create index if not exists idx_fi_tenant_module_configurations_tenant_enabled
  on public.fi_tenant_module_configurations (tenant_id, enabled);

-- ---------------------------------------------------------------------------
-- fi_tenant_module_usage — idempotent metering (no PHI / image content)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_module_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  module_key text not null,
  capability text,
  usage_type text not null,
  quantity numeric not null default 1,
  occurred_at timestamptz not null default now(),
  source_reference text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_tenant_module_usage_idempotency_unique unique (tenant_id, module_key, idempotency_key),
  constraint fi_tenant_module_usage_module_key_nonempty check (char_length(trim(module_key)) > 0),
  constraint fi_tenant_module_usage_usage_type_nonempty check (char_length(trim(usage_type)) > 0),
  constraint fi_tenant_module_usage_quantity_positive check (quantity > 0),
  constraint fi_tenant_module_usage_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_module_usage is
  'Idempotent tenant module usage metering. No raw clinical details or image content.';

create index if not exists idx_fi_tenant_module_usage_tenant_occurred
  on public.fi_tenant_module_usage (tenant_id, module_key, occurred_at desc);

-- ---------------------------------------------------------------------------
-- fi_tenant_module_overrides — temporary platform grants (cannot bypass global flag)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_module_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  module_key text not null,
  capabilities text[] not null default '{}'::text[],
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  approved_by uuid references public.fi_users (id) on delete set null,
  created_by uuid references public.fi_users (id) on delete set null,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_tenant_module_overrides_module_key_nonempty check (char_length(trim(module_key)) > 0),
  constraint fi_tenant_module_overrides_reason_nonempty check (char_length(trim(reason)) > 0),
  constraint fi_tenant_module_overrides_window_chk check (ends_at > starts_at),
  constraint fi_tenant_module_overrides_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_module_overrides is
  'Time-bounded platform overrides for module capabilities. Audited; cannot bypass FI_ENABLE_* emergency off.';

create index if not exists idx_fi_tenant_module_overrides_tenant_active
  on public.fi_tenant_module_overrides (tenant_id, module_key, ends_at)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- fi_tenant_module_audit_log — entitlement lifecycle audit
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_module_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  module_key text not null,
  capability text,
  event_type text not null,
  previous_state jsonb,
  new_state jsonb,
  actor_user_id uuid references public.fi_users (id) on delete set null,
  source text not null default 'system',
  reason text,
  subscription_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_tenant_module_audit_log_module_key_nonempty check (char_length(trim(module_key)) > 0),
  constraint fi_tenant_module_audit_log_event_type_nonempty check (char_length(trim(event_type)) > 0),
  constraint fi_tenant_module_audit_log_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_module_audit_log is
  'Append-only audit for module entitlement grants, trials, enable/disable, overrides, and access decisions.';

create index if not exists idx_fi_tenant_module_audit_log_tenant_created
  on public.fi_tenant_module_audit_log (tenant_id, module_key, created_at desc);

-- updated_at triggers (reuse entitlements helper if present)
create or replace function public.fi_entitlements_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_tenant_module_entitlements_updated_at on public.fi_tenant_module_entitlements;
create trigger trg_fi_tenant_module_entitlements_updated_at
  before update on public.fi_tenant_module_entitlements
  for each row execute procedure public.fi_entitlements_set_updated_at();

drop trigger if exists trg_fi_tenant_module_configurations_updated_at on public.fi_tenant_module_configurations;
create trigger trg_fi_tenant_module_configurations_updated_at
  before update on public.fi_tenant_module_configurations
  for each row execute procedure public.fi_entitlements_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: service_role only
-- ---------------------------------------------------------------------------
alter table public.fi_tenant_module_entitlements enable row level security;
alter table public.fi_tenant_module_configurations enable row level security;
alter table public.fi_tenant_module_usage enable row level security;
alter table public.fi_tenant_module_overrides enable row level security;
alter table public.fi_tenant_module_audit_log enable row level security;

revoke all on public.fi_tenant_module_entitlements from public;
revoke all on public.fi_tenant_module_configurations from public;
revoke all on public.fi_tenant_module_usage from public;
revoke all on public.fi_tenant_module_overrides from public;
revoke all on public.fi_tenant_module_audit_log from public;

grant select, insert, update, delete on public.fi_tenant_module_entitlements to service_role;
grant select, insert, update, delete on public.fi_tenant_module_configurations to service_role;
grant select, insert, update, delete on public.fi_tenant_module_usage to service_role;
grant select, insert, update, delete on public.fi_tenant_module_overrides to service_role;
grant select, insert on public.fi_tenant_module_audit_log to service_role;
