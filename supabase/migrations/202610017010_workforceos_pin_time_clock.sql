-- WorkforceOS: PIN-based staff time clock (clock-in at day start, clock-out at day end).
-- Bridges fi_staff PIN login/logout to fi_workforce_timesheet_entries for pay cycles.

-- ---------------------------------------------------------------------------
-- fi_workforce_time_punches — authoritative clock-in / clock-out records
-- ---------------------------------------------------------------------------
create table if not exists public.fi_workforce_time_punches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid references public.fi_staff_members (id) on delete set null,
  fi_staff_id uuid not null references public.fi_staff (id) on delete cascade,
  work_date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  pin_session_id uuid references public.fi_staff_pin_sessions (id) on delete set null,
  shift_id uuid references public.fi_staff_shifts (id) on delete set null,
  timesheet_entry_id uuid references public.fi_workforce_timesheet_entries (id) on delete set null,
  status text not null default 'open',
  source text not null default 'pin',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  client_ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_workforce_time_punches_status_chk check (
    status in ('open', 'closed', 'void')
  ),
  constraint fi_workforce_time_punches_source_chk check (
    source in ('pin', 'manager_correction', 'auto_close')
  ),
  constraint fi_workforce_time_punches_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint fi_workforce_time_punches_clock_out_after_in check (
    clock_out_at is null or clock_out_at >= clock_in_at
  )
);

comment on table public.fi_workforce_time_punches is
  'WorkforceOS: PIN clock-in/out punches linked to timesheet entries for payroll.';

create unique index if not exists idx_fi_workforce_time_punches_open_staff
  on public.fi_workforce_time_punches (tenant_id, fi_staff_id)
  where status = 'open';

create index if not exists idx_fi_workforce_time_punches_tenant_date
  on public.fi_workforce_time_punches (tenant_id, work_date desc);

create index if not exists idx_fi_workforce_time_punches_tenant_staff_date
  on public.fi_workforce_time_punches (tenant_id, fi_staff_id, work_date desc);

-- ---------------------------------------------------------------------------
-- RLS (HR-admin select; service_role DML)
-- ---------------------------------------------------------------------------
alter table public.fi_workforce_time_punches enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_workforce_time_punches_select_hr_admin
      on public.fi_workforce_time_punches;
    create policy fi_workforce_time_punches_select_hr_admin
      on public.fi_workforce_time_punches for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_workforce_time_punches.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );

    grant select on public.fi_workforce_time_punches to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_workforce_time_punches to service_role;

-- ---------------------------------------------------------------------------
-- Extend staff PIN audit trail for clock events
-- ---------------------------------------------------------------------------
alter table public.fi_staff_pin_audit_events drop constraint if exists fi_staff_pin_audit_events_kind_chk;

alter table public.fi_staff_pin_audit_events
  add constraint fi_staff_pin_audit_events_kind_chk check (
    event_kind in (
      'staff_pin.login_success',
      'staff_pin.login_failed',
      'staff_pin.locked',
      'staff_pin.set',
      'staff_pin.reset',
      'staff_pin.disabled',
      'staff_pin.logout',
      'staff_pin.reception_board_action',
      'staff_pin.clock_in',
      'staff_pin.clock_out'
    )
  );