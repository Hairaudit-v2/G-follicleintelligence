-- FI-HUBSPOT-IMPORT-1E: widen contact→lead decision states for controlled expansion.
-- Reuses fi_hubspot_contact_lead_pilot_decisions; patient creation remains forbidden.

alter table public.fi_hubspot_contact_lead_pilot_decisions
  drop constraint if exists fi_hubspot_contact_lead_pilot_decisions_state_chk;

alter table public.fi_hubspot_contact_lead_pilot_decisions
  add constraint fi_hubspot_contact_lead_pilot_decisions_state_chk check (
    decision_state in (
      'link_existing_lead',
      'create_new_lead',
      'already_linked',
      'patient_link_review_required',
      'quarantine_missing_identity',
      'quarantine_ambiguous_identity',
      'quarantine_multi_target_conflict',
      'quarantine_duplicate_source',
      'quarantine_duplicate_target',
      'quarantine_unmapped_owner',
      'quarantine_unmapped_stage',
      'quarantine_test_or_smoke',
      'quarantine_invalid_contact',
      'wrong_tenant',
      'excluded',
      'already_applied'
    )
  );

comment on table public.fi_hubspot_contact_lead_pilot_decisions is
  'FI-HUBSPOT-IMPORT-1D/1E: operator decisions for HubSpot contact → FI lead migration. Review persists without apply; patient creation forbidden.';
