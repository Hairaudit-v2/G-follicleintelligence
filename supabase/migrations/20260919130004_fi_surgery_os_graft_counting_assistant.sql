-- SurgeryOS Phase 2B: Graft counting assistant — tray review event types.

alter table public.fi_surgery_graft_count_events drop constraint if exists fi_surgery_graft_count_events_event_type_check;
alter table public.fi_surgery_graft_count_events add constraint fi_surgery_graft_count_events_event_type_check
  check (event_type in (
    'count_update',
    'tray_count',
    'tray_confirmed',
    'tray_rejected',
    'graft_reconciliation',
    'discard_logged',
    'correction'
  ));
