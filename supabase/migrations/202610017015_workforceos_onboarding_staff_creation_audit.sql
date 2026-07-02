-- WorkforceOS Onboarding Centre: audit event for locally created onboarding staff.

alter table public.fi_staff_member_audit_events
  drop constraint if exists fi_staff_member_audit_events_event_type_chk;

alter table public.fi_staff_member_audit_events
  add constraint fi_staff_member_audit_events_event_type_chk check (
    event_type in (
      'staff_synced_from_iiohr',
      'staff_sync_updated_from_iiohr',
      'staff_profile_updated',
      'staff_archived',
      'staff_restored',
      'staff_employment_status_changed',
      'staff_hr_reconciled',
      'staff_hr_linked_manually',
      'staff_hr_link_removed',
      'staff_onboarding_created'
    )
  );
