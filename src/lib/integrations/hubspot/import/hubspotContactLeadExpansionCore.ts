/**
 * FI-HUBSPOT-IMPORT-1E — pure batch policy, selection, DQ, reconcile, gates.
 */

import { createHash } from "node:crypto";

import type { HubspotImportDecision } from "./hubspotImportTypes";
import {
  assertEmailAloneCannotLinkPatient,
  assertPatientCreationForbidden,
} from "./hubspotContactLeadFieldPolicy";
import {
  HUBSPOT_CONTACT_LEAD_EXPANSION_DEFAULT_BATCH_MAX,
  HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_BATCH_MAX,
  HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_MIN_STREAK,
  HUBSPOT_CONTACT_LEAD_EXPANSION_INITIAL_BATCH_MAX,
  type HubspotContactLeadBatchReconciliation,
  type HubspotContactLeadDataQualityProfile,
  type HubspotContactLeadExpansionBatchPolicy,
  type HubspotContactLeadExpansionBatchStatus,
  type HubspotContactLeadExpansionFilter,
  type HubspotContactLeadExpansionRow,
  type HubspotContactLeadExpansionState,
  type HubspotContactLeadExpansionSummary,
} from "./hubspotContactLeadExpansionTypes";

const ALLOWLISTED_MUTATIONS = new Set([
  "fi_import_batches:insert",
  "fi_import_batches:update",
  "fi_hubspot_contact_lead_pilot_decisions:insert",
  "fi_hubspot_contact_lead_pilot_decisions:update",
  "fi_external_record_mappings:insert",
  "fi_external_record_mappings:delete",
  "fi_person_source_ids:insert",
  "fi_person_source_ids:delete",
  "fi_persons:insert",
  "fi_persons:update",
  "fi_crm_leads:insert",
  "fi_crm_leads:update",
]);

export function assertExpansionMutationAllowlist(table: string, operation: string): void {
  if (table === "fi_patients" || table === "fi_patient_source_ids") {
    throw new Error("PATIENT_GUARD: patient table mutations are forbidden in 1E");
  }
  if (table === "fi_staff" || table === "fi_users") {
    throw new Error("MUTATION_GUARD: staff/user mutations are forbidden in 1E");
  }
  const key = `${table}:${operation}`;
  if (!ALLOWLISTED_MUTATIONS.has(key)) {
    throw new Error(`MUTATION_GUARD: non-allowlisted ${operation} on ${table}`);
  }
}

export function resolveExpansionBatchMax(policy: HubspotContactLeadExpansionBatchPolicy): number {
  if (policy.batchSequence <= 1) return HUBSPOT_CONTACT_LEAD_EXPANSION_INITIAL_BATCH_MAX;
  if (
    policy.allowExpandedBatchSize &&
    policy.consecutiveReconciledStreak >= HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_MIN_STREAK
  ) {
    return HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_BATCH_MAX;
  }
  return HUBSPOT_CONTACT_LEAD_EXPANSION_DEFAULT_BATCH_MAX;
}

export function assertExpansionBatchSize(
  count: number,
  policy: HubspotContactLeadExpansionBatchPolicy,
  explicitMax?: number
): void {
  const max = explicitMax ?? resolveExpansionBatchMax(policy);
  if (count > max) {
    throw new Error(`BATCH_LIMIT: contact/lead expansion cannot exceed ${max} records`);
  }
}

export function computeExpansionChecksum(
  rows: Array<{ hubspotContactId: string; decision: string; proposedLeadId: string | null }>
): string {
  const canonical = [...rows]
    .map((r) => `${r.hubspotContactId}|${r.decision}|${r.proposedLeadId ?? ""}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

export function mapImportDecisionToExpansionState(input: {
  decision: HubspotImportDecision;
  wrongTenant: boolean;
  hasExternalLeadMapping: boolean;
  hasPersonSourceId: boolean;
  appliedByExpansionOrPilot: boolean;
  duplicateSource?: boolean;
  duplicateTarget?: boolean;
  invalidContact?: boolean;
}): HubspotContactLeadExpansionState {
  if (input.wrongTenant) return "wrong_tenant";
  if (input.appliedByExpansionOrPilot) return "already_applied";
  if (input.invalidContact) return "quarantine_invalid_contact";
  if (input.duplicateSource) return "quarantine_duplicate_source";
  if (input.duplicateTarget) return "quarantine_duplicate_target";

  switch (input.decision) {
    case "link_existing_lead":
      if (input.hasExternalLeadMapping) return "already_linked";
      return "link_existing_lead";
    case "create_new_lead":
      return "create_new_lead";
    case "skip_already_imported":
      return input.hasExternalLeadMapping || input.hasPersonSourceId
        ? "already_linked"
        : "link_existing_lead";
    case "quarantine_test_or_smoke":
      return "quarantine_test_or_smoke";
    case "quarantine_missing_identity":
      return "quarantine_missing_identity";
    case "quarantine_ambiguous_identity":
      return "quarantine_ambiguous_identity";
    case "conflict_multiple_targets":
      return "quarantine_multi_target_conflict";
    case "quarantine_patient_link_requires_stronger_evidence":
    case "link_existing_patient":
      return "patient_link_review_required";
    case "quarantine_owner_unmapped":
      return "quarantine_unmapped_owner";
    case "quarantine_stage_unmapped":
      return "quarantine_unmapped_stage";
    case "skip_out_of_scope":
      return "excluded";
    default:
      return "excluded";
  }
}

export function isApplyableExpansionDecision(state: HubspotContactLeadExpansionState): boolean {
  return state === "link_existing_lead" || state === "create_new_lead" || state === "already_linked";
}

export function plainLanguageExpansionDecision(state: HubspotContactLeadExpansionState): string {
  switch (state) {
    case "link_existing_lead":
      return "Link to existing lead";
    case "create_new_lead":
      return "Create new lead";
    case "already_linked":
      return "Already linked";
    case "patient_link_review_required":
      return "Needs patient-link review (not applied)";
    case "quarantine_test_or_smoke":
      return "Test or smoke record — quarantined";
    case "quarantine_missing_identity":
      return "Missing identity — quarantined";
    case "quarantine_ambiguous_identity":
      return "Ambiguous identity — quarantined";
    case "quarantine_multi_target_conflict":
      return "Conflict — multiple targets";
    case "quarantine_duplicate_source":
      return "Duplicate source identity — quarantined";
    case "quarantine_duplicate_target":
      return "Duplicate target identity — quarantined";
    case "quarantine_unmapped_owner":
      return "Owner not mapped (deferred enrichment)";
    case "quarantine_unmapped_stage":
      return "Required stage unmapped — quarantined";
    case "quarantine_invalid_contact":
      return "Invalid contact — quarantined";
    case "wrong_tenant":
      return "Wrong clinic — blocked";
    case "excluded":
      return "Excluded from migration";
    case "already_applied":
      return "Already applied";
    default:
      return state;
  }
}

export function filterExpansionRows(
  rows: HubspotContactLeadExpansionRow[],
  filter: HubspotContactLeadExpansionFilter
): HubspotContactLeadExpansionRow[] {
  switch (filter) {
    case "ready":
      return rows.filter((r) => r.approvedForApply && isApplyableExpansionDecision(r.decision));
    case "existing_lead":
      return rows.filter((r) =>
        ["link_existing_lead", "already_linked", "already_applied"].includes(r.decision)
      );
    case "new_lead":
      return rows.filter((r) => r.decision === "create_new_lead");
    case "patient_review":
      return rows.filter((r) => r.decision === "patient_link_review_required");
    case "missing_identity":
      return rows.filter((r) => r.decision === "quarantine_missing_identity");
    case "duplicate":
      return rows.filter((r) =>
        [
          "quarantine_duplicate_source",
          "quarantine_duplicate_target",
          "quarantine_multi_target_conflict",
        ].includes(r.decision)
      );
    case "test_smoke":
      return rows.filter((r) => r.decision === "quarantine_test_or_smoke");
    case "conflict":
      return rows.filter((r) =>
        ["quarantine_multi_target_conflict", "wrong_tenant"].includes(r.decision)
      );
    case "applied":
      return rows.filter((r) => r.decision === "already_applied");
    case "remaining":
      return rows.filter(
        (r) =>
          r.decision !== "already_applied" &&
          r.decision !== "already_linked" &&
          r.decision !== "excluded"
      );
    case "all":
    default:
      return rows;
  }
}

export function summarizeExpansionInventory(
  rows: HubspotContactLeadExpansionRow[]
): HubspotContactLeadExpansionSummary {
  const summary: HubspotContactLeadExpansionSummary = {
    totalSourceContacts: rows.length,
    alreadyLinked: 0,
    readyToLink: 0,
    proposedNewLeads: 0,
    patientReview: 0,
    quarantined: 0,
    excluded: 0,
    conflicts: 0,
    appliedThisBatch: 0,
    remaining: 0,
    migrationCompletionPercent: 0,
  };

  for (const r of rows) {
    if (["already_linked", "already_applied"].includes(r.decision)) summary.alreadyLinked += 1;
    if (r.decision === "link_existing_lead" && r.approvedForApply) summary.readyToLink += 1;
    if (r.decision === "create_new_lead") summary.proposedNewLeads += 1;
    if (r.decision === "patient_link_review_required") summary.patientReview += 1;
    if (r.decision.startsWith("quarantine_")) summary.quarantined += 1;
    if (r.decision === "excluded") summary.excluded += 1;
    if (["quarantine_multi_target_conflict", "wrong_tenant"].includes(r.decision)) {
      summary.conflicts += 1;
    }
    if (r.decision === "already_applied") summary.appliedThisBatch += 1;
  }

  const resolved =
    summary.alreadyLinked +
    summary.quarantined +
    summary.excluded +
    summary.conflicts +
    summary.patientReview;
  summary.remaining = Math.max(0, summary.totalSourceContacts - resolved);
  summary.migrationCompletionPercent =
    summary.totalSourceContacts === 0
      ? 0
      : Math.round((resolved / summary.totalSourceContacts) * 1000) / 10;

  return summary;
}

/**
 * Select next bounded expansion batch: prefer ready links, then creates.
 * Never includes patient-review as applyable.
 */
export function selectNextExpansionBatch(
  inventory: HubspotContactLeadExpansionRow[],
  max: number
): HubspotContactLeadExpansionRow[] {
  if (max <= 0) return [];
  const links = inventory.filter(
    (r) => r.decision === "link_existing_lead" && r.applyEligible && r.approvedForApply
  );
  const creates = inventory.filter(
    (r) => r.decision === "create_new_lead" && r.applyEligible && r.approvedForApply
  );
  const already = inventory.filter(
    (r) => r.decision === "already_linked" && r.approvedForApply
  );

  const out: HubspotContactLeadExpansionRow[] = [];
  const seen = new Set<string>();
  const take = (list: HubspotContactLeadExpansionRow[]) => {
    for (const row of list) {
      if (out.length >= max) return;
      if (seen.has(row.hubspotContactId)) continue;
      seen.add(row.hubspotContactId);
      out.push({
        ...row,
        approvedForApply: true,
        applyEligible: isApplyableExpansionDecision(row.decision),
      });
    }
  };

  take(links);
  take(creates);
  // Fill remainder with already_linked only if batch still under limit and needed for replay safety demos
  if (out.length === 0) take(already);

  return out.slice(0, max);
}

export function emptyDataQualityProfile(): HubspotContactLeadDataQualityProfile {
  return {
    missingNames: 0,
    missingEmails: 0,
    missingPhones: 0,
    invalidEmails: 0,
    invalidPhoneFormats: 0,
    duplicateHubspotIds: 0,
    duplicateEmails: 0,
    duplicatePhones: 0,
    multipleFiLeadTargets: 0,
    sourceIdsAlreadyMapped: 0,
    crossTenantCandidates: 0,
    possibleTestOrSmoke: 0,
    possiblePatientOverlap: 0,
    missingStages: 0,
    missingOwners: 0,
    malformedTimestamps: 0,
  };
}

export function profileExpansionDataQuality(
  rows: Array<{
    hubspotContactId: string;
    displayName: string;
    email: string | null;
    phone: string | null;
    decision: HubspotContactLeadExpansionState;
    hubspotOwnerId: string | null;
    sourceStageLabel: string | null;
    lastSourceActivityAt: string | null;
    proposedLeadId: string | null;
  }>
): HubspotContactLeadDataQualityProfile {
  const profile = emptyDataQualityProfile();
  const idCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();
  const phoneCounts = new Map<string, number>();

  for (const r of rows) {
    idCounts.set(r.hubspotContactId, (idCounts.get(r.hubspotContactId) ?? 0) + 1);
    const nameBlank =
      !r.displayName.trim() ||
      /^Contact\s+\d+$/i.test(r.displayName.trim()) ||
      r.displayName.trim() === (r.email ?? "");
    if (nameBlank) profile.missingNames += 1;
    if (!r.email) profile.missingEmails += 1;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) profile.invalidEmails += 1;
    else emailCounts.set(r.email, (emailCounts.get(r.email) ?? 0) + 1);
    if (!r.phone) profile.missingPhones += 1;
    else if (!/[\d]{6,}/.test(r.phone.replace(/\D/g, ""))) profile.invalidPhoneFormats += 1;
    else {
      const digits = r.phone.replace(/\D/g, "");
      phoneCounts.set(digits, (phoneCounts.get(digits) ?? 0) + 1);
    }
    if (!r.hubspotOwnerId) profile.missingOwners += 1;
    if (!r.sourceStageLabel) profile.missingStages += 1;
    if (r.lastSourceActivityAt && Number.isNaN(Date.parse(r.lastSourceActivityAt))) {
      profile.malformedTimestamps += 1;
    }
    if (r.decision === "quarantine_test_or_smoke") profile.possibleTestOrSmoke += 1;
    if (r.decision === "patient_link_review_required") profile.possiblePatientOverlap += 1;
    if (r.decision === "wrong_tenant") profile.crossTenantCandidates += 1;
    if (r.decision === "quarantine_multi_target_conflict") profile.multipleFiLeadTargets += 1;
    if (["already_linked", "already_applied"].includes(r.decision)) {
      profile.sourceIdsAlreadyMapped += 1;
    }
  }

  for (const c of idCounts.values()) if (c > 1) profile.duplicateHubspotIds += 1;
  for (const c of emailCounts.values()) if (c > 1) profile.duplicateEmails += 1;
  for (const c of phoneCounts.values()) if (c > 1) profile.duplicatePhones += 1;

  return profile;
}

export function buildBatchReconciliation(input: {
  batchId: string;
  approvedRecords: number;
  appliedMappings: number;
  newLeads: number;
  alreadyApplied: number;
  quarantined: number;
  excluded: number;
  failedClosed: number;
  leadCountBefore: number;
  leadCountAfter: number;
  patientCountBefore: number;
  patientCountAfter: number;
  sideEffects?: string[];
  watermarkBefore: string | null;
  watermarkAfter: string | null;
}): HubspotContactLeadBatchReconciliation {
  const accounted =
    input.appliedMappings +
    input.newLeads +
    input.alreadyApplied +
    input.quarantined +
    input.excluded +
    input.failedClosed;
  const unexplained = input.approvedRecords - accounted;
  return {
    batchId: input.batchId,
    approvedRecords: input.approvedRecords,
    appliedMappings: input.appliedMappings,
    newLeads: input.newLeads,
    alreadyApplied: input.alreadyApplied,
    quarantined: input.quarantined,
    excluded: input.excluded,
    failedClosed: input.failedClosed,
    unexplained,
    balanced: unexplained === 0,
    leadCountBefore: input.leadCountBefore,
    leadCountAfter: input.leadCountAfter,
    patientCountBefore: input.patientCountBefore,
    patientCountAfter: input.patientCountAfter,
    patientMutationCount: input.patientCountAfter - input.patientCountBefore,
    sideEffects: input.sideEffects ?? [],
    watermarkBefore: input.watermarkBefore,
    watermarkAfter: input.watermarkAfter,
    watermarkUnchanged: input.watermarkBefore === input.watermarkAfter,
  };
}

export function assertPriorBatchReconciled(input: {
  priorBatch: {
    status: string;
    reconciliation?: { balanced?: boolean; unexplained?: number } | null;
  } | null;
}): void {
  if (!input.priorBatch) return;
  const recon = input.priorBatch.reconciliation;
  const reconciled =
    input.priorBatch.status === "import_completed" &&
    recon?.balanced === true &&
    (recon.unexplained ?? 1) === 0;
  if (!reconciled) {
    throw new Error(
      "BATCH_GATE: prior expansion batch remains unreconciled — next apply is blocked"
    );
  }
}

export function assertReconciliationBalanced(recon: HubspotContactLeadBatchReconciliation): void {
  if (!recon.balanced || recon.unexplained !== 0) {
    throw new Error(
      `RECONCILE_FAIL: unexplained=${recon.unexplained} (approved=${recon.approvedRecords})`
    );
  }
  if (recon.patientMutationCount !== 0) {
    throw new Error("PATIENT_GUARD: patient mutation count must be 0");
  }
  if (!recon.watermarkUnchanged) {
    throw new Error("WATERMARK_GUARD: backup watermark changed during expansion batch");
  }
  if (recon.sideEffects.length > 0) {
    throw new Error("SIDE_EFFECT_GUARD: prohibited side effects detected");
  }
}

export function primaryActionForBatchStatus(
  status: HubspotContactLeadExpansionBatchStatus
): string {
  switch (status) {
    case "draft":
      return "Review exceptions";
    case "ready_for_review":
      return "Preview batch";
    case "approved":
      return "Apply approved batch";
    case "applying":
      return "Applying…";
    case "applied":
      return "Verify batch";
    case "reconciled":
      return "Replay batch";
    case "replay_verified":
      return "Prepare rollback preview";
    case "rollback_preview_ready":
      return "Prepare next batch";
    case "blocked":
      return "Investigate stop condition";
    default:
      return "Review exceptions";
  }
}

export function assertPatientProtectionGates(): void {
  assertPatientCreationForbidden(false);
  assertEmailAloneCannotLinkPatient(false);
}

export function detectDuplicateNewLeadRisk(
  candidates: Array<{ email: string | null; displayName: string; decision: string }>
): boolean {
  const createKeys = new Map<string, number>();
  for (const c of candidates) {
    if (c.decision !== "create_new_lead") continue;
    const key = `${(c.email ?? "").toLowerCase()}|${c.displayName.trim().toLowerCase()}`;
    if (!key.replace(/\|/g, "")) continue;
    createKeys.set(key, (createKeys.get(key) ?? 0) + 1);
  }
  for (const n of createKeys.values()) {
    if (n > 1) return true;
  }
  return false;
}
