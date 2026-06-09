-- Stage 2G: clinic-floor staff PIN credentials, sessions, and audit trail.
-- PIN hashes are service-role only; never exposed to authenticated clients.

create table if not exists fi_staff_pins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  staff_id uuid not null references fi_staff (id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  is_active boolean not null default true,
  failed_attempt_count integer not null default 0,
  locked_until timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid references fi_users (id) on delete set null,
  updated_by_user_id uuid references fi_users (id) on delete set null,
  constraint fi_staff_pins_tenant_staff_unique unique (tenant_id, staff_id),
  constraint fi_staff_pins_failed_attempt_nonneg check (failed_attempt_count >= 0)
);

comment on table fi_staff_pins is
  'Clinic-floor 4-digit PIN credentials (hashed). Service-role mutations only; metadata surfaced via server loaders.';

create index if not exists idx_fi_staff_pins_tenant on fi_staff_pins (tenant_id);
create index if not exists idx_fi_staff_pins_staff on fi_staff_pins (staff_id);

alter table fi_staff_pins enable row level security;

grant select, insert, update, delete on fi_staff_pins to service_role;

-- Active PIN sessions for shared-terminal clinic-floor access.
create table if not exists fi_staff_pin_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  staff_id uuid not null references fi_staff (id) on delete cascade,
  session_token uuid not null default gen_random_uuid(),
  staff_full_name text not null,
  staff_role text not null,
  expires_at timestamptz not null,
  ended_at timestamptz,
  client_ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint fi_staff_pin_sessions_token_unique unique (session_token)
);

comment on table fi_staff_pin_sessions is
  'HttpOnly cookie session rows for limited clinic-floor PIN access.';

create index if not exists idx_fi_staff_pin_sessions_tenant_staff
  on fi_staff_pin_sessions (tenant_id, staff_id)
  where ended_at is null;

create index if not exists idx_fi_staff_pin_sessions_token
  on fi_staff_pin_sessions (session_token)
  where ended_at is null;

alter table fi_staff_pin_sessions enable row level security;

grant select, insert, update on fi_staff_pin_sessions to service_role;

-- Append-only PIN lifecycle audit (no raw PIN values).
create table if not exists fi_staff_pin_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  event_kind text not null,
  staff_id uuid references fi_staff (id) on delete set null,
  actor_fi_user_id uuid references fi_users (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_staff_pin_audit_events_kind_chk check (
    event_kind in (
      'staff_pin.login_success',
      'staff_pin.login_failed',
      'staff_pin.locked',
      'staff_pin.set',
      'staff_pin.reset',
      'staff_pin.disabled',
      'staff_pin.logout'
    )
  ),
  constraint fi_staff_pin_audit_events_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table fi_staff_pin_audit_events is
  'Audit trail for staff PIN lifecycle and login attempts (never stores PIN values).';

create index if not exists idx_fi_staff_pin_audit_tenant_created
  on fi_staff_pin_audit_events (tenant_id, created_at desc);

alter table fi_staff_pin_audit_events enable row level security;

grant select, insert on fi_staff_pin_audit_events to service_role;
