/**
 * FI-HUBSPOT-IMPORT-1A — privacy-safe reconciliation metrics (pure).
 */

import { HUBSPOT_SALES_PIPELINE_STAGE_MAP_V1, mapHubspotSalesPipelineStageV1 } from "./hubspotImportMappingV1";
import type {
  HubspotImportDecision,
  HubspotImportDecisionRecord,
  HubspotImportDryRunReport,
  HubspotImportReconciliationMetrics,
  HubspotOwnerMappingClass,
} from "./hubspotImportTypes";
import { HUBSPOT_IMPORT_MAPPING_VERSION } from "./hubspotImportTypes";

const ALL_DECISIONS: HubspotImportDecision[] = [
  "create_new_lead",
  "link_existing_lead",
  "link_existing_patient",
  "enrich_existing_lead",
  "import_timeline_event",
  "import_source_evidence",
  "skip_already_imported",
  "skip_out_of_scope",
  "quarantine_missing_identity",
  "quarantine_ambiguous_identity",
  "quarantine_owner_unmapped",
  "quarantine_stage_unmapped",
  "quarantine_patient_link_requires_stronger_evidence",
  "quarantine_test_or_smoke",
  "conflict_multiple_targets",
  "unsupported",
];

export function emptyDecisionCounts(): Record<HubspotImportDecision, number> {
  const out = {} as Record<HubspotImportDecision, number>;
  for (const d of ALL_DECISIONS) out[d] = 0;
  return out;
}

export function emptyReconciliationMetrics(): HubspotImportReconciliationMetrics {
  return {
    sourceIdentity: {
      uniqueSourceIds: 0,
      duplicateSourceIds: 0,
      missingCanonicalIds: 0,
    },
    identityResolution: {
      exactExistingExternalMatch: 0,
      exactLeadMatch: 0,
      exactPatientMatch: 0,
      proposedCreate: 0,
      ambiguous: 0,
      noMatch: 0,
      multipleTargetConflict: 0,
    },
    ownerMapping: {
      activeStaffMapped: 0,
      inactiveStaffMapped: 0,
      unmapped: 0,
      systemOwner: 0,
      ambiguous: 0,
    },
    pipeline: {
      mappedStages: 0,
      unmappedStages: 0,
      historyOnlyStages: 0,
      potentiallyRegressiveStageChanges: 0,
    },
    integrity: {
      wrongTenantCandidates: 0,
      duplicateFiTargets: 0,
      multipleSourcesToOneTarget: 0,
      oneSourceToMultipleTargets: 0,
      sideEffectRiskRecords: 0,
    },
    decisions: emptyDecisionCounts(),
  };
}

export function buildContactReconciliationMetrics(input: {
  decisions: HubspotImportDecisionRecord[];
  sourceIds: string[];
  wrongTenantCount: number;
  ownerClasses: HubspotOwnerMappingClass[];
}): HubspotImportReconciliationMetrics {
  const metrics = emptyReconciliationMetrics();
  const idCounts = new Map<string, number>();
  for (const id of input.sourceIds) {
    const key = id.trim();
    if (!key) {
      metrics.sourceIdentity.missingCanonicalIds += 1;
      continue;
    }
    idCounts.set(key, (idCounts.get(key) ?? 0) + 1);
  }
  metrics.sourceIdentity.uniqueSourceIds = idCounts.size;
  for (const count of idCounts.values()) {
    if (count > 1) metrics.sourceIdentity.duplicateSourceIds += 1;
  }

  metrics.integrity.wrongTenantCandidates = input.wrongTenantCount;

  const fiTargetCounts = new Map<string, number>();
  const sourceToTargets = new Map<string, Set<string>>();

  for (const d of input.decisions) {
    metrics.decisions[d.decision] += 1;

    if (d.reasonCode === "tenant_mismatch_fail_closed") {
      metrics.integrity.wrongTenantCandidates += 1;
    }

    if (
      d.identityTier === "tier1_external_identity" ||
      d.identityTier === "tier2_explicit_hubspot_ref" ||
      d.identityTier === "tier3_prior_verified_relationship"
    ) {
      metrics.identityResolution.exactExistingExternalMatch += 1;
    }
    if (d.decision === "link_existing_lead") metrics.identityResolution.exactLeadMatch += 1;
    if (d.decision === "link_existing_patient") metrics.identityResolution.exactPatientMatch += 1;
    if (d.decision === "create_new_lead") metrics.identityResolution.proposedCreate += 1;
    if (
      d.decision === "quarantine_ambiguous_identity" ||
      d.decision === "quarantine_patient_link_requires_stronger_evidence"
    ) {
      metrics.identityResolution.ambiguous += 1;
    }
    if (d.decision === "quarantine_missing_identity") metrics.identityResolution.noMatch += 1;
    if (d.decision === "conflict_multiple_targets") {
      metrics.identityResolution.multipleTargetConflict += 1;
      metrics.integrity.oneSourceToMultipleTargets += 1;
    }

    if (d.proposedFiEntityId) {
      const key = `${d.proposedFiEntityType}:${d.proposedFiEntityId}`;
      fiTargetCounts.set(key, (fiTargetCounts.get(key) ?? 0) + 1);
      const set = sourceToTargets.get(d.sourceIdentity.sourceRecordId) ?? new Set();
      set.add(key);
      sourceToTargets.set(d.sourceIdentity.sourceRecordId, set);
    }

    if (d.sideEffectRisks.includes("pipeline_regression")) {
      metrics.pipeline.potentiallyRegressiveStageChanges += 1;
    }
    if (d.sideEffectRisks.length > 0 && !d.sideEffectRisks.every((r) => r === "none")) {
      metrics.integrity.sideEffectRiskRecords += 1;
    }

    if (d.decision === "quarantine_stage_unmapped") {
      metrics.pipeline.unmappedStages += 1;
    }
  }

  for (const count of fiTargetCounts.values()) {
    if (count > 1) {
      metrics.integrity.duplicateFiTargets += 1;
      metrics.integrity.multipleSourcesToOneTarget += 1;
    }
  }

  for (const c of input.ownerClasses) {
    if (c === "linked_active_staff") metrics.ownerMapping.activeStaffMapped += 1;
    else if (c === "linked_inactive_staff") metrics.ownerMapping.inactiveStaffMapped += 1;
    else if (c === "integration_system_owner") metrics.ownerMapping.systemOwner += 1;
    else if (c === "ambiguous_owner") metrics.ownerMapping.ambiguous += 1;
    else if (c === "unknown_owner" || c === "excluded_test_owner") metrics.ownerMapping.unmapped += 1;
  }

  for (const stage of HUBSPOT_SALES_PIPELINE_STAGE_MAP_V1) {
    if (stage.classification === "exact_equivalent" || stage.classification === "closest_approved") {
      metrics.pipeline.mappedStages += 1;
    } else if (stage.classification === "history_only") {
      metrics.pipeline.historyOnlyStages += 1;
    } else {
      metrics.pipeline.unmappedStages += 1;
    }
  }

  return metrics;
}

export function recommendFirstPilot(metrics: HubspotImportReconciliationMetrics): HubspotImportDryRunReport["recommendedPilot"] {
  const ownerMapped =
    metrics.ownerMapping.activeStaffMapped + metrics.ownerMapping.inactiveStaffMapped;
  const ownerTotal =
    ownerMapped +
    metrics.ownerMapping.unmapped +
    metrics.ownerMapping.systemOwner +
    metrics.ownerMapping.ambiguous;
  const ownerCoverage = ownerTotal > 0 ? ownerMapped / ownerTotal : 0;

  const contactAssessed =
    metrics.sourceIdentity.uniqueSourceIds ||
    Object.values(metrics.decisions).reduce((a, b) => a + b, 0);
  const ambiguityRate =
    contactAssessed > 0
      ? (metrics.identityResolution.ambiguous + metrics.identityResolution.multipleTargetConflict) /
        contactAssessed
      : 1;
  const createRate =
    contactAssessed > 0 ? metrics.identityResolution.proposedCreate / contactAssessed : 0;

  // Prefer owner mapping when coverage is weak — reduces assignee ambiguity before leads.
  if (ownerTotal > 0 && ownerCoverage < 0.85) {
    return {
      option: "A_owner_mapping",
      dataset: "owners",
      maxRecords: 25,
      rationale:
        "Owner→staff deterministic coverage is incomplete; mapping active staff first reduces assignee ambiguity and has zero patient/lead duplication risk.",
    };
  }

  if (
    metrics.integrity.wrongTenantCandidates === 0 &&
    metrics.identityResolution.multipleTargetConflict === 0 &&
    ambiguityRate <= 0.15 &&
    createRate >= 0.05
  ) {
    return {
      option: "B_new_lead",
      dataset: "contacts",
      maxRecords: 25,
      rationale:
        "Contact identity ambiguity is bounded and proposed new leads are isolatable; patient auto-create remains forbidden.",
    };
  }

  return {
    option: "C_form_submission_evidence",
    dataset: "form_submissions",
    maxRecords: 25,
    rationale:
      "Safer evidence-only pilot: Conversion ID submissions link without clinical writes or lead creation.",
  };
}

export function verdictFromMetrics(metrics: HubspotImportReconciliationMetrics): {
  verdict: HubspotImportDryRunReport["verdict"];
  reasons: string[];
} {
  const reasons: string[] = [];

  if (metrics.integrity.wrongTenantCandidates > 0) {
    reasons.push("Wrong-tenant candidates detected — tenant isolation RED.");
    return { verdict: "RED", reasons };
  }
  if (metrics.identityResolution.multipleTargetConflict > 0) {
    reasons.push("One source maps to multiple FI targets of the same type.");
    return { verdict: "RED", reasons };
  }

  const assessed = Object.values(metrics.decisions).reduce((a, b) => a + b, 0);
  const ambiguityRate =
    assessed > 0
      ? (metrics.identityResolution.ambiguous + metrics.decisions.quarantine_ambiguous_identity) /
        assessed
      : 0;

  if (metrics.pipeline.historyOnlyStages > 0 || metrics.pipeline.unmappedStages > 0) {
    reasons.push("Pipeline stage mapping needs business decisions for history-only/unmapped stages.");
  }
  if (metrics.ownerMapping.unmapped > 0 || metrics.ownerMapping.ambiguous > 0) {
    reasons.push("Owner mappings incomplete for some HubSpot owners.");
  }
  if (ambiguityRate > 0.2) {
    reasons.push(`Contact ambiguity rate ${(ambiguityRate * 100).toFixed(1)}% exceeds 20% comfort band.`);
  }

  // Additive identity schema gap is always an AMBER note for 1A.
  reasons.push(
    "Preferred external-identity schema is partially covered by existing source-id tables; additive migration proposed, not applied."
  );

  if (reasons.some((r) => r.includes("RED"))) {
    return { verdict: "RED", reasons };
  }

  const blockingAmber =
    ambiguityRate > 0.2 ||
    metrics.ownerMapping.unmapped > metrics.ownerMapping.activeStaffMapped ||
    metrics.pipeline.historyOnlyStages > 0;

  if (blockingAmber) {
    return { verdict: "AMBER", reasons };
  }

  reasons.unshift("Dry-run controls pass: zero entity writes by design; deterministic identity precedence defined.");
  return { verdict: "GREEN_TO_PROCEED_TO_PILOT", reasons };
}

export function buildDryRunReport(input: {
  tenantId: string;
  integrationId: string;
  dataset: HubspotImportDryRunReport["dataset"];
  decisions: HubspotImportDecisionRecord[];
  metrics: HubspotImportReconciliationMetrics;
  generatedAt?: string;
}): HubspotImportDryRunReport {
  const { verdict, reasons } = verdictFromMetrics(input.metrics);
  return {
    evidenceType: "hubspot_import_1a_dry_run",
    milestone: "FI-HUBSPOT-IMPORT-1A",
    mappingVersion: HUBSPOT_IMPORT_MAPPING_VERSION,
    mode: "dry_run",
    tenantId: input.tenantId,
    integrationId: input.integrationId,
    dataset: input.dataset,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    entityWritesPerformed: false,
    notificationsEmitted: false,
    automationsTriggered: false,
    backupWatermarkChanged: false,
    metrics: input.metrics,
    decisions: input.decisions,
    pipelineStageInventory: HUBSPOT_SALES_PIPELINE_STAGE_MAP_V1.map((s) => ({
      hubspotStageLabel: s.hubspotStageLabel,
      fiSlug: s.fiSlug,
      classification: s.classification,
      sideEffectRisks: [...s.sideEffectRisks],
    })),
    recommendedPilot: recommendFirstPilot(input.metrics),
    verdict,
    verdictReasons: reasons,
  };
}

export function stageDecisionForLabel(label: string | null | undefined): HubspotImportDecision {
  const mapped = mapHubspotSalesPipelineStageV1(label);
  if (mapped.classification === "quarantine" || mapped.classification === "unsupported") {
    return "quarantine_stage_unmapped";
  }
  if (mapped.classification === "history_only") {
    return "import_source_evidence";
  }
  return "import_source_evidence";
}
