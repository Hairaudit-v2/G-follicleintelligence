/**
 * FI-HUBSPOT-IMPORT-1B — HubSpot owner → FI staff mapping types.
 */

export const HUBSPOT_OWNER_MAPPING_MILESTONE = "FI-HUBSPOT-IMPORT-1B" as const;
export const HUBSPOT_OWNER_MAPPING_KIND = "hubspot_owner_staff_mapping_1b" as const;
export const HUBSPOT_OWNER_SOURCE_SYSTEM = "hubspot" as const;
export const HUBSPOT_OWNER_SOURCE_OBJECT_TYPE = "owner" as const;
export const HUBSPOT_OWNER_MAPPING_DEFAULT_MAX = 2;
export const HUBSPOT_OWNER_MAPPING_EXPANSION_MAX = 25;

export type HubspotOwnerMatchMethod =
  | "exact_staff_email_within_tenant"
  | "existing_staff_source_id"
  | "pre_approved_explicit_mapping";

export type HubspotOwnerMappingDecision =
  | "apply_mapping"
  | "already_applied"
  | "quarantine_unresolved"
  | "quarantine_inactive_staff"
  | "quarantine_ambiguous"
  | "conflict_source_mapped_elsewhere"
  | "conflict_target_has_other_owner"
  | "reject_name_only"
  | "reject_wrong_tenant"
  | "reject_over_limit"
  | "skip_archived_owner";

export type HubspotOwnerMappingProposal = {
  hubspotOwnerId: string;
  hubspotOwnerIdHash: string;
  staffId: string | null;
  tenantId: string;
  integrationId: string;
  matchMethod: HubspotOwnerMatchMethod | null;
  decision: HubspotOwnerMappingDecision;
  reasonCode: string;
  emailNormalizedHash: string | null;
  staffIsActive: boolean | null;
};

export type HubspotOwnerMappingMutationRecord = {
  table: "fi_staff_source_ids" | "fi_import_batches";
  operation: "insert" | "update" | "delete";
  rowId: string;
  allowlisted: true;
};

export type HubspotOwnerMappingBatchReport = {
  evidenceType: "hubspot_owner_staff_mapping_1b";
  milestone: typeof HUBSPOT_OWNER_MAPPING_MILESTONE;
  mode: "preview" | "apply" | "replay" | "rollback_preview" | "rollback_apply";
  tenantId: string;
  integrationId: string;
  batchId: string | null;
  maxRecords: number;
  expandEnabled: boolean;
  generatedAt: string;
  proposals: HubspotOwnerMappingProposal[];
  counts: {
    evaluated: number;
    proposedApply: number;
    alreadyApplied: number;
    quarantined: number;
    conflicts: number;
    wrongTenant: number;
    applied: number;
    rolledBack: number;
  };
  mutations: HubspotOwnerMappingMutationRecord[];
  staffRowsMutated: false;
  userRowsMutated: false;
  notificationsEmitted: false;
  backupWatermarkChanged: false;
  watermarkBefore: string | null;
  watermarkAfter: string | null;
  ok: boolean;
  failClosedReasons: string[];
};
