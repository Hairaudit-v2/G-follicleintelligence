/**
 * FI-HUBSPOT-IMPORT-1A — privacy-safe HubSpot → FI OS mapping configuration (v1).
 *
 * Explicit stage/owner/lead-vs-patient policy only. No fuzzy person matching.
 * Stage-1 CSV import that auto-creates patients is intentionally NOT reused here.
 */

import type {
  HubspotOwnerMappingClass,
  HubspotPipelineStageClass,
  HubspotSideEffectRisk,
} from "./hubspotImportTypes";
import { HUBSPOT_IMPORT_MAPPING_VERSION } from "./hubspotImportTypes";

export const MAPPING_VERSION = HUBSPOT_IMPORT_MAPPING_VERSION;

/** Canonical FI CRM pipeline key used by Import Centre / CRM foundation. */
export const FI_CRM_PIPELINE_KEY = "hair_restoration";

/**
 * HubSpot Sales Pipeline stages (FI-HUBSPOT-BACKUP-1 manifest) → FI CRM slugs.
 * Internal HubSpot stage IDs were pending API extraction; labels are authoritative for v1.
 */
export type HubspotDealStageMapping = {
  hubspotStageLabel: string;
  fiSlug: string | null;
  classification: HubspotPipelineStageClass;
  sideEffectRisks: HubspotSideEffectRisk[];
  notes: string;
};

export const HUBSPOT_SALES_PIPELINE_STAGE_MAP_V1: readonly HubspotDealStageMapping[] = [
  {
    hubspotStageLabel: "Contacted",
    fiSlug: "contacted",
    classification: "exact_equivalent",
    sideEffectRisks: ["analytics"],
    notes: "Manifest stage 1 (10%).",
  },
  {
    hubspotStageLabel: "Appointment Scheduled",
    fiSlug: "consult_scheduled",
    classification: "exact_equivalent",
    sideEffectRisks: ["analytics", "tasks"],
    notes: "Manifest stage 2 (30%). Must not create appointments on import.",
  },
  {
    hubspotStageLabel: "Consulted",
    fiSlug: "consult_completed",
    classification: "closest_approved",
    sideEffectRisks: ["analytics"],
    notes: "Manifest stage 3 (70%). Closest FI consult-completed equivalent.",
  },
  {
    hubspotStageLabel: "Surgery Unqualified",
    fiSlug: null,
    classification: "history_only",
    sideEffectRisks: ["analytics", "conversion_reporting"],
    notes: "No safe current-stage FI equivalent without business decision.",
  },
  {
    hubspotStageLabel: "Surgery Qualified",
    fiSlug: "treatment_planning",
    classification: "closest_approved",
    sideEffectRisks: ["analytics", "conversion_reporting"],
    notes: "Manifest stage 5 (80%). Requires business confirmation before apply.",
  },
  {
    hubspotStageLabel: "Booked Non-Surgical",
    fiSlug: "deposit_or_booked",
    classification: "closest_approved",
    sideEffectRisks: ["analytics", "revenue_reporting", "conversion_reporting"],
    notes: "High-risk commercial stage — evidence/history only in first write gate.",
  },
  {
    hubspotStageLabel: "Booked Surgical",
    fiSlug: "deposit_or_booked",
    classification: "closest_approved",
    sideEffectRisks: ["analytics", "revenue_reporting", "conversion_reporting"],
    notes: "Must not create surgery bookings or appointments on import.",
  },
  {
    hubspotStageLabel: "Deposit Paid",
    fiSlug: "deposit_or_booked",
    classification: "closest_approved",
    sideEffectRisks: ["analytics", "revenue_reporting"],
    notes: "Financial field import deferred; stage mapping for CRM evidence only.",
  },
  {
    hubspotStageLabel: "Completed Session",
    fiSlug: "won_closed",
    classification: "closest_approved",
    sideEffectRisks: ["analytics", "conversion_reporting"],
    notes: "HubSpot Won status.",
  },
  {
    hubspotStageLabel: "Post Operative Treatment",
    fiSlug: "in_treatment",
    classification: "closest_approved",
    sideEffectRisks: ["analytics"],
    notes: "HubSpot Won status; clinical records remain native FI only.",
  },
  {
    hubspotStageLabel: "Lost",
    fiSlug: "lost",
    classification: "exact_equivalent",
    sideEffectRisks: ["analytics"],
    notes: "Manifest stage 11.",
  },
] as const;

const STAGE_BY_LABEL = new Map(
  HUBSPOT_SALES_PIPELINE_STAGE_MAP_V1.map((m) => [m.hubspotStageLabel.trim().toLowerCase(), m])
);

export function mapHubspotSalesPipelineStageV1(raw: string | null | undefined): HubspotDealStageMapping {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) {
    return {
      hubspotStageLabel: "",
      fiSlug: null,
      classification: "unsupported",
      sideEffectRisks: [],
      notes: "Empty stage.",
    };
  }
  const hit = STAGE_BY_LABEL.get(key);
  if (hit) return hit;
  return {
    hubspotStageLabel: raw!.trim(),
    fiSlug: null,
    classification: "quarantine",
    sideEffectRisks: ["analytics"],
    notes: "Unmapped HubSpot stage label — quarantine / history-only.",
  };
}

/** FI CRM pipeline stage sort order for regression detection (higher = later). */
export const FI_CRM_STAGE_SORT_ORDER: Readonly<Record<string, number>> = {
  new: 10,
  contacted: 20,
  qualified: 30,
  consult_scheduled: 40,
  consult_completed: 50,
  treatment_planning: 60,
  quote_sent: 70,
  deposit_or_booked: 80,
  in_treatment: 90,
  won_closed: 100,
  nurture: 15,
  lost: 5,
};

export function wouldRegressFiStage(
  currentFiSlug: string | null | undefined,
  proposedFiSlug: string | null | undefined
): boolean {
  if (!currentFiSlug || !proposedFiSlug) return false;
  const cur = FI_CRM_STAGE_SORT_ORDER[currentFiSlug];
  const next = FI_CRM_STAGE_SORT_ORDER[proposedFiSlug];
  if (cur == null || next == null) return false;
  // Lost/nurture are terminal-ish; never overwrite a later productive stage with earlier.
  if (currentFiSlug === "won_closed" && proposedFiSlug !== "won_closed") return true;
  if (currentFiSlug === "lost" && proposedFiSlug !== "lost") return false; // reopening is not auto-applied
  return next < cur;
}

/**
 * Lead vs patient policy (IMPORT-1A).
 * HubSpot contacts must not create FI patients. Patient links require Tier 1–3 evidence.
 */
export const LEAD_VS_PATIENT_POLICY_V1 = {
  createPatientFromHubspotContact: false,
  overwritePatientDemographics: false,
  overwriteClinicalNotes: false,
  overwriteConsent: false,
  emailAloneMayLinkLead: true,
  emailAloneMayLinkPatient: false,
  phoneAloneMayLinkLead: false,
  phoneAloneMayLinkPatient: false,
  fuzzyNameMatching: false,
  probabilisticMatching: false,
  crossTenantMatching: false,
} as const;

export const OWNER_MAPPING_POLICY_V1 = {
  createStaffFromHubspotOwner: false,
  assignLeadsToInactiveStaff: false,
  exactEmailMatchWithinTenant: true,
  unresolvedOwnerAssignee: null as null,
  retainSourceOwnerIdAsProvenance: true,
} as const;

export function classifyOwnerMapping(input: {
  linkedStaffId: string | null;
  staffIsActive: boolean | null;
  candidateCount: number;
  isSystemOwner: boolean;
  isTestOwner: boolean;
}): HubspotOwnerMappingClass {
  if (input.isTestOwner) return "excluded_test_owner";
  if (input.isSystemOwner) return "integration_system_owner";
  if (input.candidateCount > 1) return "ambiguous_owner";
  if (input.linkedStaffId && input.staffIsActive === true) return "linked_active_staff";
  if (input.linkedStaffId && input.staffIsActive === false) return "linked_inactive_staff";
  return "unknown_owner";
}

/** Provenance fields retained on every imported / linked record (metadata only). */
export const PROVENANCE_FIELD_KEYS_V1 = [
  "source_system",
  "integration_id",
  "hubspot_object_type",
  "hubspot_record_id",
  "hubspot_owner_id",
  "source_created_at",
  "source_updated_at",
  "import_batch_id",
  "mapping_version",
  "backup_run_id",
  "backup_manifest_sha",
] as const;

/**
 * Preferred external identity unique key (document-level).
 * Existing tables cover subsets; additive migration proposed but not applied in 1A.
 */
export const PREFERRED_EXTERNAL_IDENTITY_UNIQUE_KEY = [
  "tenant_id",
  "source_system",
  "integration_id",
  "source_object_type",
  "source_record_id",
] as const;

export const EXISTING_EXTERNAL_IDENTITY_TABLES = [
  "fi_external_record_mappings",
  "fi_person_source_ids",
  "fi_patient_source_ids",
  "fi_crm_lead_source_ids",
  "fi_staff_source_ids",
] as const;
