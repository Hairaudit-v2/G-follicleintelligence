-- WorkforceOS: Staff Access Centre — login invitation tracking for existing active staff.
-- Isolated from onboarding invitations; supports provision without creating new staff records.

create table if not exists public.fi_staff_login_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  fi_staff_id uuid references public.fi_staff (id) on delete set null,
  fi_user_id uuid references public.fi_users (id) on delete set null,
  invite_email text not null,
  invite_link text,
  status text not null default 'pending',
  invited_by uuid,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null,
  email_sent_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_login_invitations_status_chk check (
    status in ('pending', 'accepted', 'expired', 'revoked')
  )
);

comment on table public.fi_staff_login_invitations is
  'WorkforceOS Staff Access Centre — login invite tracking for existing fi_staff_members.';

create index if not exists idx_fi_staff_login_invitations_tenant_staff
  on public.fi_staff_login_invitations (tenant_id, staff_member_id);

create index if not exists idx_fi_staff_login_invitations_tenant_status
  on public.fi_staff_login_invitations (tenant_id, status)
  where status = 'pending';

alter table public.fi_staff_login_invitations enable row level security;

grant select, insert, update, delete on public.fi_staff_login_invitations to service_role;
