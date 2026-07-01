-- WorkforceOS Phase 2 Sprint 5: AI workforce planning engine snapshots.

create table if not exists public.fi_workforce_planning_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  horizon_start date not null,
  horizon_end date not null,
  snapshot_json jsonb not null default '{}'::jsonb,
  next_best_action_json jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  constraint fi_workforce_planning_snapshot_json_object check (jsonb_typeof(snapshot_json) = 'object'),
  constraint fi_workforce_planning_action_json_object check (jsonb_typeof(next_best_action_json) = 'object'),
  constraint fi_workforce_planning_horizon_range check (horizon_end >= horizon_start)
);

comment on table public.fi_workforce_planning_snapshots is
  'WorkforceOS Phase 2 Sprint 5: workforce planning signals and next-best-action snapshots.';

create unique index if not exists idx_fi_workforce_planning_snapshots_tenant_horizon
  on public.fi_workforce_planning_snapshots (tenant_id, horizon_start, horizon_end);

create index if not exists idx_fi_workforce_planning_snapshots_tenant_generated
  on public.fi_workforce_planning_snapshots (tenant_id, generated_at desc);

alter table public.fi_workforce_planning_snapshots enable row level security;

do $$
begin
  if to_regclass('public.fi_users') is not null then
    drop policy if exists fi_workforce_planning_snapshots_select_hr on public.fi_workforce_planning_snapshots;
    create policy fi_workforce_planning_snapshots_select_hr
      on public.fi_workforce_planning_snapshots for select to authenticated
      using (
        exists (
          select 1 from public.fi_users u
          where u.auth_user_id = auth.uid()
            and u.tenant_id = fi_workforce_planning_snapshots.tenant_id
            and lower(coalesce(u.role, '')) in ('fi_admin', 'admin', 'owner', 'hr_manager')
        )
      );
    grant select on public.fi_workforce_planning_snapshots to authenticated;
  end if;
end $$;

grant select, insert, update, delete on public.fi_workforce_planning_snapshots to service_role;