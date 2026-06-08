-- Stage Platform Security 1A: FI Platform Administrator role and impersonation audit.

-- Allow fi_platform_admin in fi_os_identities (replaces inline check constraint from 20260614120001).
alter table fi_os_identities drop constraint if exists fi_os_identities_role_chk;

alter table fi_os_identities
  add constraint fi_os_identities_role_chk check (
    os_role in (
      'fi_platform_admin',
      'fi_admin',
      'fi_auditor',
      'fi_clinic_admin',
      'fi_doctor',
      'fi_nurse',
      'fi_consultant'
    )
  );

comment on table fi_os_identities is 'FI OS platform roles. fi_platform_admin is full cross-tenant platform operator (see app policy). No client RLS — service role from trusted app servers only.';

-- Impersonation sessions: service-role writes from Next.js only; no authenticated RLS policies.
create table if not exists fi_os_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  initiator_auth_user_id uuid not null references auth.users (id) on delete cascade,
  target_auth_user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid references fi_tenants (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  client_ip text,
  user_agent text
);

create index if not exists idx_fi_os_impersonation_initiator_started
  on fi_os_impersonation_sessions (initiator_auth_user_id, started_at desc);

create index if not exists idx_fi_os_impersonation_target_started
  on fi_os_impersonation_sessions (target_auth_user_id, started_at desc);

alter table fi_os_impersonation_sessions enable row level security;

comment on table fi_os_impersonation_sessions is 'Platform-admin user impersonation audit (initiator, target, IP, tenant). Insert/update via service role from trusted servers only.';

-- HairAudit auditor → platform administrator (full FI OS).
insert into fi_os_identities (auth_user_id, os_role)
select id, 'fi_platform_admin'
from auth.users
where lower(email) = lower('auditor@hairaudit.com')
on conflict (auth_user_id) do update set
  os_role = excluded.os_role,
  updated_at = now();
