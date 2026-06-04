-- Follicle Intelligence OS: platform-level roles (server / service role only).
-- Not readable by the browser anon key + RLS; the Next.js server uses SUPABASE_SERVICE_ROLE_KEY.
--
-- After migrations: ensure `auditor@hairaudit.com` exists in auth.users (Supabase Dashboard → Authentication),
-- then re-run the INSERT below or run `supabase db reset` so the seed row attaches to that user.

create table if not exists fi_os_identities (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  os_role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_os_identities_role_chk check (
    os_role in (
      'fi_admin',
      'fi_auditor',
      'fi_clinic_admin',
      'fi_doctor',
      'fi_nurse',
      'fi_consultant'
    )
  )
);

create index if not exists idx_fi_os_identities_role on fi_os_identities (os_role);

alter table fi_os_identities enable row level security;

comment on table fi_os_identities is 'FI OS platform roles. No client policies — use service role from trusted app servers only.';

-- Seed: HairAudit auditor account — platform admin (full FI OS / tenant directory).
-- Runs after auth.users row exists (create user in Supabase Auth UI or sign-up first).
insert into fi_os_identities (auth_user_id, os_role)
select id, 'fi_admin'
from auth.users
where lower(email) = lower('auditor@hairaudit.com')
on conflict (auth_user_id) do update set
  os_role = excluded.os_role,
  updated_at = now();
