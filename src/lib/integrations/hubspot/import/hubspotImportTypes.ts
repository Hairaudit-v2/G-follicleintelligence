/**
 * FI-HUBSPOT-IMPORT-1A — shared types for HubSpot → FI OS import architecture.
 * Dry-run only in this gate; no Layer E application types mutate production entities.
 */

export const HUBSPOT_IMPORT_SOURCE_SYSTEM = "hubspot" as const;
export const HUBSPOT_IMPORT_MAPPING_VERSION = "v1" as const;

export type HubspotImportMappingVersion = typeof HUBSPOT_IMPORT_MAPPING_VERSION;

export type HubspotImportDataset =
  | "owners"
  | "contacts"
  | "forms"
  | "form_submissions"
  | "messages"
  | "conversations"
  | "notes"
  | "calls"
  | "meetings"
  | "tasks"
  | "deals"
  | "pipelines"
  | "files"
  | "verification_events";

export type HubspotImportBatchMode = "dry_run" | "apply" | "replay" | "rollback_preview";

export type HubspotImportBatchStatus =
  | "planned"
  | "dry_run"
  | "dry_run_complete"
  | "awaiting_approval"
  | "applying"
  | "applied"
  | "verification_failed"
  | "verified"
  | "partial"
  | "failed"
  | "rolled_back"
  | "superseded";

export type HubspotImportDecision =
  | "create_new_lead"
  | "link_existing_lead"
  | "link_existing_patient"
  | "enrich_existing_lead"
  | "import_timeline_event"
  | "import_source_evidence"
  | "skip_already_imported"
  | "skip_out_of_scope"
  | "quarantine_missing_identity"
  | "quarantine_ambiguous_identity"
  | "quarantine_owner_unmapped"
  | "quarantine_stage_unmapped"
  | "quarantine_patient_link_requires_stronger_evidence"
  | "quarantine_test_or_smoke"
  | "conflict_multiple_targets"
  | "unsupported";

export type HubspotIdentityTier =
  | "tier1_external_identity"
  | "tier2_explicit_hubspot_ref"
  | "tier3_prior_verified_relationship"
  | "tier4_deterministic_business_identity"
  | "tier5_ambiguous"
  | "none";

export type HubspotIdentityConfidence = "exact_external" | "exact_business" | "none";

export type FiImportEntityType =
  | "person"
  | "lead"
  | "patient"
  | "staff"
  | "timeline_event"
  | "source_evidence"
  | "none";

export type HubspotOwnerMappingClass =
  | "linked_active_staff"
  | "linked_inactive_staff"
  | "integration_system_owner"
  | "unknown_owner"
  | "ambiguous_owner"
  | "excluded_test_owner";

export type HubspotPipelineStageClass =
  | "exact_equivalent"
  | "closest_approved"
  | "history_only"
  | "unsupported"
  | "quarantine";

export type HubspotSideEffectRisk =
  | "none"
  | "notifications"
  | "tasks"
  | "patient_communications"
  | "automation"
  | "analytics"
  | "conversion_reporting"
  | "revenue_reporting"
  | "staff_assignment"
  | "pipeline_regression";

export type HubspotImportSourceIdentity = {
  tenantId: string;
  integrationId: string;
  sourceSystem: typeof HUBSPOT_IMPORT_SOURCE_SYSTEM;
  sourceObjectType: string;
  sourceRecordId: string;
};

export type HubspotImportDecisionRecord = {
  sourceIdentity: HubspotImportSourceIdentity;
  decision: HubspotImportDecision;
  proposedFiEntityType: FiImportEntityType;
  proposedFiEntityId: string | null;
  identityTier: HubspotIdentityTier;
  confidenceType: HubspotIdentityConfidence;
  reasonCode: string;
  mappingVersion: HubspotImportMappingVersion;
  sourceCreatedAt: string | null;
  sourceUpdatedAt: string | null;
  sideEffectRisks: HubspotSideEffectRisk[];
  decisionStatus: "dry_run";
  /** Privacy-safe hash of source record id (sha256 hex prefix). */
  sourceIdHash: string;
};

export type HubspotContactDryRunInput = {
  hubspotContactId: string;
  tenantId: string;
  integrationId: string;
  emailNormalized: string | null;
  phoneDigits: string | null;
  phoneCorrupted: boolean;
  hubspotOwnerId: string | null;
  lifecycleStage: string | null;
  leadStatus: string | null;
  dealStageLabel: string | null;
  archived: boolean;
  isTestOrSmoke: boolean;
  sourceCreatedAt: string | null;
  sourceUpdatedAt: string | null;
  importStatus: string | null;
};

export type HubspotOwnerDryRunInput = {
  hubspotOwnerId: string;
  tenantId: string;
  integrationId: string;
  emailNormalized: string | null;
  archived: boolean;
  isSystemOwner: boolean;
  isTestOwner: boolean;
  displayNameHash: string | null;
};

/** Snapshot of existing FI OS identity anchors (read-only). */
export type FiIdentitySnapshot = {
  /** external_id → FI entity (from fi_external_record_mappings / source_ids). */
  externalContactToPerson: Map<string, string>;
  externalContactToPatient: Map<string, string>;
  externalContactToLead: Map<string, string>;
  externalOwnerToStaff: Map<string, { staffId: string; isActive: boolean }>;
  /** normalized email → person ids (tenant-scoped). */
  emailToPersonIds: Map<string, string[]>;
  /** person → lead ids */
  personToLeadIds: Map<string, string[]>;
  /** person → patient id */
  personToPatientId: Map<string, string>;
  /** phone digits → person ids (optional; phone-only match quarantines in v1). */
  phoneToPersonIds: Map<string, string[]>;
  /** staff email → staff */
  staffEmailToStaff: Map<string, { staffId: string; isActive: boolean }>;
  /** Known FI OS lead current stage slugs by lead id */
  leadCurrentStageSlug: Map<string, string>;
};

export type HubspotImportReconciliationMetrics = {
  sourceIdentity: {
    uniqueSourceIds: number;
    duplicateSourceIds: number;
    missingCanonicalIds: number;
  };
  identityResolution: {
    exactExistingExternalMatch: number;
    exactLeadMatch: number;
    exactPatientMatch: number;
    proposedCreate: number;
    ambiguous: number;
    noMatch: number;
    multipleTargetConflict: number;
  };
  ownerMapping: {
    activeStaffMapped: number;
    inactiveStaffMapped: number;
    unmapped: number;
    systemOwner: number;
    ambiguous: number;
  };
  pipeline: {
    mappedStages: number;
    unmappedStages: number;
    historyOnlyStages: number;
    potentiallyRegressiveStageChanges: number;
  };
  integrity: {
    wrongTenantCandidates: number;
    duplicateFiTargets: number;
    multipleSourcesToOneTarget: number;
    oneSourceToMultipleTargets: number;
    sideEffectRiskRecords: number;
  };
  decisions: Record<HubspotImportDecision, number>;
};

export type HubspotImportDryRunReport = {
  evidenceType: "hubspot_import_1a_dry_run";
  milestone: "FI-HUBSPOT-IMPORT-1A";
  mappingVersion: HubspotImportMappingVersion;
  mode: "dry_run";
  tenantId: string;
  integrationId: string;
  dataset: HubspotImportDataset;
  generatedAt: string;
  entityWritesPerformed: false;
  notificationsEmitted: false;
  automationsTriggered: false;
  backupWatermarkChanged: false;
  metrics: HubspotImportReconciliationMetrics;
  decisions: HubspotImportDecisionRecord[];
  pipelineStageInventory: Array<{
    hubspotStageLabel: string;
    fiSlug: string | null;
    classification: HubspotPipelineStageClass;
    sideEffectRisks: HubspotSideEffectRisk[];
  }>;
  recommendedPilot: {
    option: "A_owner_mapping" | "B_new_lead" | "C_form_submission_evidence";
    dataset: HubspotImportDataset;
    maxRecords: number;
    rationale: string;
  };
  verdict: "GREEN_TO_PROCEED_TO_PILOT" | "AMBER" | "RED";
  verdictReasons: string[];
};
