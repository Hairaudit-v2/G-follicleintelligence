/**
 * FI-HUBSPOT-IMPORT-1C — owner-resolution workspace types.
 */

export const HUBSPOT_OWNER_RESOLUTION_MILESTONE = "FI-HUBSPOT-IMPORT-1C" as const;
export const HUBSPOT_OWNER_RESOLUTION_KIND = "hubspot_owner_staff_mapping_1c" as const;
export const HUBSPOT_OWNER_RESOLUTION_BATCH_MAX = 10;
export const HUBSPOT_OWNER_RESOLUTION_MILESTONE_MAX_NEW = 25;

export type HubspotOwnerResolutionState =
  | "mapped"
  | "proposed"
  | "unresolved"
  | "no_matching_staff"
  | "archived_source_owner"
  | "historical_only"
  | "conflict"
  | "excluded"
  | "already_applied";

export type HubspotOwnerResolutionFilter =
  | "needs_attention"
  | "suggested_match"
  | "no_match"
  | "archived"
  | "historical_only"
  | "conflict"
  | "mapped"
  | "all";

export type HubspotOwnerCandidateEvidence =
  | "exact_staff_email_within_tenant"
  | "approved_email_alias"
  | "trusted_user_staff_link"
  | "exact_name_with_supporting_evidence"
  | "operator_approved_historical"
  | "previous_migration_decision";

export type HubspotOwnerStaffCandidate = {
  staffId: string;
  fullName: string;
  role: string;
  status: "active" | "inactive" | "archived" | "on_leave";
  email: string | null;
  alreadyHasHubspotOwner: boolean;
  existingHubspotOwnerId: string | null;
  evidence: HubspotOwnerCandidateEvidence[];
  rank: number;
  deterministic: boolean;
};

export type HubspotOwnerWorkspaceRow = {
  hubspotOwnerId: string;
  displayName: string;
  email: string | null;
  archived: boolean;
  resolutionState: HubspotOwnerResolutionState;
  decisionId: string | null;
  targetStaffId: string | null;
  targetStaffName: string | null;
  operatorNote: string | null;
  ownedContacts: number;
  ownedDeals: number;
  ownedTasks: number;
  ownedActivities: number;
  lastOwnedActivityAt: string | null;
  inMigrationCohort: boolean;
  candidates: HubspotOwnerStaffCandidate[];
  conflictReason: string | null;
  sortPriority: number;
};

export type HubspotOwnerWorkspaceSummary = {
  totalOwners: number;
  mapped: number;
  proposed: number;
  unresolved: number;
  archivedOrHistorical: number;
  conflicts: number;
  needingAttention: number;
  excluded: number;
  noMatchingStaff: number;
  alreadyApplied: number;
  /** Active/relevant owners with a mapping (excludes archived unused). */
  relevantActiveCoveragePct: number | null;
  relevantActiveDenominator: number;
  relevantActiveMapped: number;
};

export type HubspotOwnerResolutionDecisionInput = {
  hubspotOwnerId: string;
  resolutionState: HubspotOwnerResolutionState;
  targetStaffId?: string | null;
  operatorNote?: string | null;
  matchEvidence?: Record<string, unknown>;
};
