-- WorkforceOS Phase 2 Sprint 2: payroll / wage engine foundation.

-- ---------------------------------------------------------------------------
-- fi_workforce_wage_profiles — staff wage profiles (hourly / daily / contractor)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_workforce_wage_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  fi_staff_id uuid references public.fi_staff (id) on delete set null,
  rate_type text not null default 'hourly',
  base_rate_cents bigint not null,
  currency text not null default 'AUD',
  award_code text,
  award_loading_codes text[] not null default '{}'::text[],
  effective_from date not null default current_date,
  effective_to date,
  is_active boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_workforce_wage_profiles_base_rate_positive check (base_rate_cents > 0),
  constraint fi_workforce_wage_profiles_rate_type_chk check (
    rate_type in ('hourly', 'daily', 'contractor')
  ),
  constraint fi_workforce_wage_profiles_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_workforce_wage_profiles_effective_range check (
    effective_to is null or effective_to >= effective_from
  )
);

comment on table public.fi_workforce_wage_profiles is
  'WorkforceOS Phase 2: staff wage profiles with hourly, daily, or contractor rates and award placeholders.';

create unique index if not exists idx_fi_workforce_wage_profiles_tenant_staff_active
  on public.fi_workforce_wage_profiles (tenant_id, staff_member_id)
  where is_active = true and effective_to is null;

create index if not exists idx_fi_workforce_wage_profiles_tenant_fi_staff
  on public.fi_workforce_wage_profiles (tenant_id, fi_staff_id)
  where fi_staff_id is not null;

-- ---------------------------------------------------------------------------
-- fi_workforce_award_loading_placeholders — tenant award loading rules (placeholder)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_workforce_award_loading_placeholders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  award_code text not null,
  loading_code text not null,
  display_name text not null,
  loading_multiplier numeric(6, 3) not null default 1.000,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_workforce_award_loading_multiplier_positive check (loading_multiplier > 0),
  constraint fi_workforce_award_loading_codes_nonempty check (
    char_length(trim(award_code)) > 0 and char_length(trim(loading_code)) > 0
  )
);

comment on table public.fi_workforce_award_loading_placeholders is
  'WorkforceOS Phase 2: placeholder award loading multipliers (weekend, overtime, public holiday, etc.).';

create unique index if not exists idx_fi_workforce_award_loading_tenant_codes
  on public.fi_workforce_award_loading_placeholders (tenant_id, lower(award_code), lower(loading_code))
  where is_active = true;

-- ---------------------------------------------------------------------------
-- fi_workforce_timesheet_entries — timesheet-ready labour cost structure
-- ---------------------------------------------------------------------------
create table if not exists public.fi_workforce_timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff_members (id) on delete cascade,
  wage_profile_id uuid references public.fi_workforce_wage_profiles (id) on delete set null,
  shift_id uuid references public.fi_staff_shifts (id) on delete set null,
  work_date date not null,
  entry_type text not null default 'regular',
  minutes_worked integer not null default 0,
  rate_type_snapshot text not null,
  base_rate_cents_snapshot bigint not null,
  award_loadings_snapshot jsonb not null default '[]'::jsonb,
  gross_cost_cents bigint not null default 0,
  status text not null default 'draft',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_workforce_timesheet_minutes_nonnegative check (minutes_worked >= 0),
  constraint fi_workforce_timesheet_base_rate_positive check (base_rate_cents_snapshot > 0),
  constraint fi_workforce_timesheet_gross_nonnegative check (gross_cost_cents >= 0),
  constraint fi_workforce_timesheet_entry_type_chk check (
    entry_type in ('regular', 'overtime', 'break', 'leave', 'surgery_day', 'admin')
  ),
  constraint fi_workforce_timesheet_status_chk check (
    status in ('draft', 'submitted', 'approved', 'void')
  ),
  constraint fi_workforce_timesheet_rate_type_chk check (
    rate_type_snapshot in ('hourly', 'daily', 'contractor')
  ),
  constraint fi_workforce_timesheet_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_workforce_timesheet_award_loadings_array check (
    jsonb_typeof(award_loadings_snapshot) = 'array'
  )
);

comment on table public.fi_workforce_timesheet_entries is
  'WorkforceOS Phase 2: timesheet-ready labour entries with rate snapshots and computed gross cost.';

create index if not exists idx_fi_workforce_timesheet_tenant_staff_date
  on public.fi_workforce_timesheet_entries (tenant_id, staff_member_id, work_date desc);

create index if not exists idx_fi_workforce_timesheet_tenant_shift
  on public.fi_workforce_timesheet_entries (tenant_id, shift_id)
  where shift_id is not null;

-- ---------------------------------------------------------------------------
-- RLS (HR-admin select; service_role DML — matches recruitment sprint pattern)
-- ---------------------------------------------------------------------------
alter table public.fi_workforce_wage_profiles enable row level security;
alter table public.fi_workforce_award_loading_placeholders enable row level security;
alter table public.fi_workforce_timesheet_entries enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_workforce_wage_profiles_select_hr_admin on public.fi_workforce_wage_profiles;
    create policy fi_workforce_wage_profiles_select_hr_admin
      on public.fi_workforce_wage_profiles for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_workforce_wage_profiles.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );

    drop policy if exists fi_workforce_award_loading_select_hr_admin on public.fi_workforce_award_loading_placeholders;
    create policy fi_workforce_award_loading_select_hr_admin
      on public.fi_workforce_award_loading_placeholders for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_workforce_award_loading_placeholders.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );

    drop policy if exists fi_workforce_timesheet_select_hr_admin on public.fi_workforce_timesheet_entries;
    create policy fi_workforce_timesheet_select_hr_admin
      on public.fi_workforce_timesheet_entries for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_workforce_timesheet_entries.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );

    grant select on public.fi_workforce_wage_profiles to authenticated;
    grant select on public.fi_workforce_award_loading_placeholders to authenticated;
    grant select on public.fi_workforce_timesheet_entries to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_workforce_wage_profiles to service_role;
grant select, insert, update, delete on public.fi_workforce_award_loading_placeholders to service_role;
grant select, insert, update, delete on public.fi_workforce_timesheet_entries to service_role;