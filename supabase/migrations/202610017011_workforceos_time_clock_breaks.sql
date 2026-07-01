-- WorkforceOS: break punches and manager correction support for PIN time clock.

-- ---------------------------------------------------------------------------
-- fi_workforce_time_punch_breaks — unpaid break intervals within a shift punch
-- ---------------------------------------------------------------------------
create table if not exists public.fi_workforce_time_punch_breaks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  punch_id uuid not null references public.fi_workforce_time_punches (id) on delete cascade,
  break_start_at timestamptz not null,
  break_end_at timestamptz,
  status text not null default 'open',
  source text not null default 'pin',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_workforce_time_punch_breaks_status_chk check (
    status in ('open', 'closed', 'void')
  ),
  constraint fi_workforce_time_punch_breaks_source_chk check (
    source in ('pin', 'manager_correction')
  ),
  constraint fi_workforce_time_punch_breaks_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint fi_workforce_time_punch_breaks_end_after_start check (
    break_end_at is null or break_end_at >= break_start_at
  )
);

comment on table public.fi_workforce_time_punch_breaks is
  'WorkforceOS: break intervals deducted from PIN punch gross minutes for net paid time.';

create unique index if not exists idx_fi_workforce_time_punch_breaks_open_punch
  on public.fi_workforce_time_punch_breaks (punch_id)
  where status = 'open';

create index if not exists idx_fi_workforce_time_punch_breaks_tenant_punch
  on public.fi_workforce_time_punch_breaks (tenant_id, punch_id);

alter table public.fi_workforce_time_punch_breaks enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_workforce_time_punch_breaks_select_hr_admin
      on public.fi_workforce_time_punch_breaks;
    create policy fi_workforce_time_punch_breaks_select_hr_admin
      on public.fi_workforce_time_punch_breaks for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_workforce_time_punch_breaks.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );

    grant select on public.fi_workforce_time_punch_breaks to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_workforce_time_punch_breaks to service_role;

-- PIN break lifecycle audit events
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
      'staff_pin.clock_out',
      'staff_pin.break_start',
      'staff_pin.break_end'
    )
  );