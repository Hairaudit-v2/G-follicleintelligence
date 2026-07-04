-- ---------------------------------------------------------------------------
-- RECONSTRUCTED HISTORICAL MIGRATION — drift repair (do NOT treat as new change)
--
-- This migration was ALREADY APPLIED to the Follicle Intelligence production
-- database (schema_migrations version 20261005170001) but had no corresponding
-- file in the repository, causing repo <-> production drift.
--
-- SQL recovered from remote `supabase_migrations.schema_migrations.statements`
-- and verified against live production objects (fi_roster_shift_audit_events,
-- fi_staff_shifts.adjustment_reason/updated_by/cancellation_reason,
-- fi_clear_generated_roster_shifts). Committed here only to restore accurate
-- migration history — effect is already live in production.
-- ---------------------------------------------------------------------------

-- WorkforceOS — roster manual adjustments (FI-ROSTER-MANUAL-ADJUSTMENTS-1).

alter table public.fi_staff_shifts
  add column if not exists updated_by uuid references public.fi_users (id) on delete set null,
  add column if not exists adjustment_reason text,
  add column if not exists cancellation_reason text;

comment on column public.fi_staff_shifts.updated_by is
  'fi_users.id of the actor who last updated this shift (manual adjustments).';

comment on column public.fi_staff_shifts.adjustment_reason is
  'Reason code for manual create/update (sick cover, training shift, etc.).';

comment on column public.fi_staff_shifts.cancellation_reason is
  'Reason code when a shift is cancelled or removed from the active roster.';

create table if not exists public.fi_roster_shift_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  shift_id uuid references public.fi_staff_shifts (id) on delete set null,
  staff_id uuid references public.fi_staff (id) on delete set null,
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  action_type text not null,
  reason text,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_roster_shift_audit_events_action_type_chk check (
    action_type in (
      'shift_created_manual',
      'shift_updated_manual',
      'shift_cancelled',
      'shift_removed_generated',
      'staff_marked_sick_for_shift',
      'replacement_shift_created'
    )
  ),
  constraint fi_roster_shift_audit_events_old_values_object check (jsonb_typeof(old_values) = 'object'),
  constraint fi_roster_shift_audit_events_new_values_object check (jsonb_typeof(new_values) = 'object'),
  constraint fi_roster_shift_audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_roster_shift_audit_events is
  'Append-only audit trail for roster shift manual adjustments.';

create index if not exists idx_fi_roster_shift_audit_tenant_created
  on public.fi_roster_shift_audit_events (tenant_id, created_at desc);

create index if not exists idx_fi_roster_shift_audit_tenant_shift
  on public.fi_roster_shift_audit_events (tenant_id, shift_id, created_at desc)
  where shift_id is not null;

alter table public.fi_roster_shift_audit_events enable row level security;

grant select, insert on public.fi_roster_shift_audit_events to service_role;

create or replace function public.fi_clear_generated_roster_shifts(
  p_tenant_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_updated_by uuid default null,
  p_cancellation_reason text default 'clear_generated_roster'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_cancelled_count integer := 0;
begin
  update public.fi_staff_shifts
  set status = 'cancelled',
      cancellation_reason = coalesce(nullif(trim(p_cancellation_reason), ''), 'clear_generated_roster'),
      updated_at = v_now,
      updated_by = p_updated_by
  where tenant_id = p_tenant_id
    and status = 'scheduled'
    and shift_source in ('standard_hours', 'copy_week')
    and starts_at >= p_range_start
    and starts_at < p_range_end;
  get diagnostics v_cancelled_count = row_count;

  return jsonb_build_object(
    'ok', true,
    'cancelled_count', v_cancelled_count
  );
end;
$$;

comment on function public.fi_clear_generated_roster_shifts is
  'Cancel scheduled generated roster shifts in a period. Preserves manual and confirmed shifts.';

grant execute on function public.fi_clear_generated_roster_shifts(uuid, timestamptz, timestamptz, uuid, text) to service_role;
