-- WorkforceOS Phase 2 Sprint 3: shift cost intelligence — query performance indexes.

create index if not exists idx_fi_staff_shifts_tenant_type_starts_active
  on public.fi_staff_shifts (tenant_id, shift_type, starts_at)
  where status <> 'cancelled';

create index if not exists idx_fi_staff_shifts_tenant_starts_active
  on public.fi_staff_shifts (tenant_id, starts_at)
  where status <> 'cancelled';

create index if not exists idx_fi_staff_event_assignments_tenant_surgery_event
  on public.fi_staff_event_assignments (tenant_id, event_id)
  where event_source = 'surgery' and assignment_status <> 'cancelled';

create index if not exists idx_fi_surgeries_tenant_scheduled_date_active
  on public.fi_surgeries (tenant_id, scheduled_date)
  where status <> 'cancelled';

comment on index public.idx_fi_staff_shifts_tenant_type_starts_active is
  'WorkforceOS Phase 2 Sprint 3: accelerates surgery-day and roster cost queries.';