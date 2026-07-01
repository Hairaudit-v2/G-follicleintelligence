-- WorkforceOS: Staff Onboarding Centre — isolated invitation, checklist, and PIN setup tables.
-- Does not alter fi_staff_members schema or existing auth/PIN tables.

create table if not exists public.fi_staff_onboarding_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  invite_token text not null,
  invite_email text not null,
  status text not null default 'pending',
  invited_by uuid,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_onboarding_invitations_status_chk check (
    status in ('pending', 'accepted', 'expired')
  ),
  constraint fi_staff_onboarding_invitations_token_unique unique (invite_token)
);

comment on table public.fi_staff_onboarding_invitations is
  'WorkforceOS staff onboarding invitation workflow — isolated from tenant provisioning onboarding-os.';

create index if not exists idx_fi_staff_onboarding_invitations_tenant_staff
  on public.fi_staff_onboarding_invitations (tenant_id, staff_member_id);

create index if not exists idx_fi_staff_onboarding_invitations_tenant_status
  on public.fi_staff_onboarding_invitations (tenant_id, status)
  where status = 'pending';

create table if not exists public.fi_staff_onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  account_created boolean not null default false,
  pin_chosen boolean not null default false,
  permissions_assigned boolean not null default false,
  training_pending boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_onboarding_checklists_tenant_staff_unique unique (tenant_id, staff_member_id)
);

comment on table public.fi_staff_onboarding_checklists is
  'Onboarding progress checklist per staff member — synced from operational state where possible.';

create index if not exists idx_fi_staff_onboarding_checklists_tenant
  on public.fi_staff_onboarding_checklists (tenant_id);

-- Isolated PIN setup tokens for onboarding invite flow (does not modify fi_staff_pins).
create table if not exists public.fi_staff_onboarding_pin_setups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  fi_staff_id uuid not null references public.fi_staff (id) on delete cascade,
  invitation_id uuid references public.fi_staff_onboarding_invitations (id) on delete set null,
  setup_token text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_onboarding_pin_setups_status_chk check (
    status in ('pending', 'completed', 'expired')
  ),
  constraint fi_staff_onboarding_pin_setups_token_unique unique (setup_token)
);

comment on table public.fi_staff_onboarding_pin_setups is
  'Token-gated PIN setup for onboarding invites — delegates to fi_staff_pins without modifying auth.';

create index if not exists idx_fi_staff_onboarding_pin_setups_tenant_staff
  on public.fi_staff_onboarding_pin_setups (tenant_id, fi_staff_id);

alter table public.fi_staff_onboarding_invitations enable row level security;
alter table public.fi_staff_onboarding_checklists enable row level security;
alter table public.fi_staff_onboarding_pin_setups enable row level security;

grant select, insert, update, delete on public.fi_staff_onboarding_invitations to service_role;
grant select, insert, update, delete on public.fi_staff_onboarding_checklists to service_role;
grant select, insert, update, delete on public.fi_staff_onboarding_pin_setups to service_role;
