/**
 * FI-HUBSPOT-IMPORT-1E — controlled contact → lead migration expansion types.
 */

export const HUBSPOT_CONTACT_LEAD_EXPANSION_MILESTONE = "FI-HUBSPOT-IMPORT-1E" as const;
export const HUBSPOT_CONTACT_LEAD_EXPANSION_KIND = "hubspot_contact_lead_expansion_1e" as const;

/** Initial expansion batch (E1). */
export const HUBSPOT_CONTACT_LEAD_EXPANSION_INITIAL_BATCH_MAX = 100;
/** Default after first reconciled batch. */
export const HUBSPOT_CONTACT_LEAD_EXPANSION_DEFAULT_BATCH_MAX = 250;
/** Only after ≥3 consecutive reconciled batches + explicit approval. */
export const HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_BATCH_MAX = 500;
/** Consecutive reconciled batches required before allowing 500. */
export const HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_MIN_STREAK = 3;

export type HubspotContactLeadExpansionState =
  | "link_existing_lead"
  | "create_new_lead"
  | "already_linked"
  | "patient_link_review_required"
  | "quarantine_missing_identity"
  | "quarantine_ambiguous_identity"
  | "quarantine_multi_target_conflict"
  | "quarantine_duplicate_source"
  | "quarantine_duplicate_target"
  | "quarantine_test_or_smoke"
  | "quarantine_unmapped_stage"
  | "quarantine_unmapped_owner"
  | "quarantine_invalid_contact"
  | "wrong_tenant"
  | "excluded"
  | "already_applied";

export type HubspotContactLeadExpansionFilter =
  | "ready"
  | "existing_lead"
  | "new_lead"
  | "patient_review"
  | "missing_identity"
  | "duplicate"
  | "test_smoke"
  | "conflict"
  | "applied"
  | "remaining"
  | "all";

export type HubspotContactLeadExpansionBatchStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "applying"
  | "applied"
  | "reconciled"
  | "replay_verified"
  | "rollback_preview_ready"
  | "blocked";

export type HubspotContactLeadExpansionRow = {
  hubspotContactId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  decision: HubspotContactLeadExpansionState;
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
  applyEligible: boolean;
};

export type HubspotContactLeadExpansionSummary = {
  totalSourceContacts: number;
  alreadyLinked: number;
  readyToLink: number;
  proposedNewLeads: number;
  patientReview: number;
  quarantined: number;
  excluded: number;
  conflicts: number;
  appliedThisBatch: number;
  remaining: number;
  migrationCompletionPercent: number;
};

export type HubspotContactLeadDataQualityProfile = {
  missingNames: number;
  missingEmails: number;
  missingPhones: number;
  invalidEmails: number;
  invalidPhoneFormats: number;
  duplicateHubspotIds: number;
  duplicateEmails: number;
  duplicatePhones: number;
  multipleFiLeadTargets: number;
  sourceIdsAlreadyMapped: number;
  crossTenantCandidates: number;
  possibleTestOrSmoke: number;
  possiblePatientOverlap: number;
  missingStages: number;
  missingOwners: number;
  malformedTimestamps: number;
};

export type HubspotContactLeadExpansionDecisionInput = {
  hubspotContactId: string;
  decision: HubspotContactLeadExpansionState;
  approvedForApply?: boolean;
  operatorNote?: string | null;
  targetLeadId?: string | null;
};

export type HubspotContactLeadBatchReconciliation = {
  batchId: string;
  approvedRecords: number;
  appliedMappings: number;
  newLeads: number;
  alreadyApplied: number;
  quarantined: number;
  excluded: number;
  failedClosed: number;
  unexplained: number;
  balanced: boolean;
  leadCountBefore: number;
  leadCountAfter: number;
  patientCountBefore: number;
  patientCountAfter: number;
  patientMutationCount: number;
  sideEffects: string[];
  watermarkBefore: string | null;
  watermarkAfter: string | null;
  watermarkUnchanged: boolean;
};

export type HubspotContactLeadExpansionBatchPolicy = {
  batchSequence: number;
  consecutiveReconciledStreak: number;
  allowExpandedBatchSize: boolean;
};
