-- WorkforceOS Phase 1C: expand fi_staff_member_audit_events event_type CHECK
-- to include all Phase 1C audit events (offboarding, merge, credentials, etc.).

alter table public.fi_staff_member_audit_events
  drop constraint if exists fi_staff_member_audit_events_event_type_chk;

alter table public.fi_staff_member_audit_events
  add constraint fi_staff_member_audit_events_event_type_chk check (
    event_type in (
      -- IIOHR sync + lifecycle (WorkforceOS staff lifecycle management)
      'staff_synced_from_iiohr',
      'staff_sync_updated_from_iiohr',
      'staff_profile_updated',
      'staff_archived',
      'staff_restored',
      'staff_employment_status_changed',
      'staff_hr_reconciled',
      'staff_hr_linked_manually',
      'staff_hr_link_removed',
      'staff_onboarding_created',
      -- WorkforceOS Phase 1C audit events (WORKFORCE_PHASE_1C_AUDIT_EVENTS)
      'workforce_manual_identity_linked',
      'workforce_duplicate_dismissed',
      'workforce_duplicate_approved_for_merge',
      'workforce_staff_merged',
      'workforce_staff_offboarded',
      'workforce_credential_upserted',
      'workforce_certification_upserted',
      'workforce_compliance_automation_run',
      'workforce_canonical_staff_selected',
      'workforce_merge_recommendation_generated',
      'workforce_manual_review_requested',
      'workforce_reconciliation_recommendation_approved',
      'workforce_duplicate_merge_recommended',
      'workforce_iiohr_sync_completed'
    )
  );
