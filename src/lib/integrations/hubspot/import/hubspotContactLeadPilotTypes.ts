/**
 * FI-HUBSPOT-IMPORT-1D — contact → lead pilot types (patient-protection gate).
 */

export const HUBSPOT_CONTACT_LEAD_PILOT_MILESTONE = "FI-HUBSPOT-IMPORT-1D" as const;
export const HUBSPOT_CONTACT_LEAD_PILOT_KIND = "hubspot_contact_lead_pilot_1d" as const;
export const HUBSPOT_CONTACT_LEAD_PILOT_BATCH_MAX = 25;

export type HubspotContactLeadPilotState =
  | "link_existing_lead"
  | "create_new_lead"
  | "already_linked"
  | "patient_link_review_required"
  | "quarantine_missing_identity"
  | "quarantine_ambiguous_identity"
  | "quarantine_multi_target_conflict"
  | "quarantine_unmapped_owner"
  | "quarantine_unmapped_stage"
  | "quarantine_test_or_smoke"
  | "wrong_tenant"
  | "excluded"
  | "already_applied";

export type HubspotContactLeadPilotFilter =
  | "ready"
  | "existing_lead"
  | "new_lead"
  | "patient_review"
  | "quarantined"
  | "conflict"
  | "applied"
  | "all";

export type HubspotContactLeadFieldPolicy =
  | "source_identity_only"
  | "fill_when_blank"
  | "append_alternate"
  | "preserve_fi_native"
  | "quarantine_on_conflict"
  | "out_of_scope";

export type HubspotContactLeadPilotRow = {
  hubspotContactId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  decision: HubspotContactLeadPilotState;
  reasonCode: string;
  matchEvidence: string;
  proposedLeadId: string | null;
  proposedLeadLabel: string | null;
  hubspotOwnerId: string | null;
  ownerResolutionStatus: string;
  sourceStageLabel: string | null;
  mappedFiStageSlug: string | null;
  patientProtectionWarning: string | null;
  quarantineReason: string | null;
  lastSourceActivityAt: string | null;
  approvedForApply: boolean;
  identityTier: string;
};

export type HubspotContactLeadPilotSummary = {
  totalPilotRecords: number;
  linkedExistingLeads: number;
  proposedNewLeads: number;
  patientLinkReviews: number;
  quarantined: number;
  conflicts: number;
  readyToApply: number;
  applied: number;
  alreadyApplied: number;
};

export type HubspotContactLeadPilotDecisionInput = {
  hubspotContactId: string;
  decision: HubspotContactLeadPilotState;
  approvedForApply?: boolean;
  operatorNote?: string | null;
  targetLeadId?: string | null;
};
