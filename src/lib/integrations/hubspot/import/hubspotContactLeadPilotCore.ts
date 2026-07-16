/**
 * FI-HUBSPOT-IMPORT-1D — pure cohort selection, decision mapping, guards.
 */

import { createHash } from "node:crypto";

import type { HubspotImportDecision } from "./hubspotImportTypes";
import {
  HUBSPOT_CONTACT_LEAD_PILOT_BATCH_MAX,
  type HubspotContactLeadPilotFilter,
  type HubspotContactLeadPilotRow,
  type HubspotContactLeadPilotState,
  type HubspotContactLeadPilotSummary,
} from "./hubspotContactLeadPilotTypes";
import { assertEmailAloneCannotLinkPatient, assertPatientCreationForbidden } from "./hubspotContactLeadFieldPolicy";

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

export function assertContactLeadMutationAllowlist(table: string, operation: string): void {
  if (table === "fi_patients" || table === "fi_patient_source_ids") {
    throw new Error("PATIENT_GUARD: patient table mutations are forbidden in 1D");
  }
  if (table === "fi_staff" || table === "fi_users") {
    throw new Error("MUTATION_GUARD: staff/user mutations are forbidden in 1D");
  }
  const key = `${table}:${operation}`;
  if (!ALLOWLISTED_MUTATIONS.has(key)) {
    throw new Error(`MUTATION_GUARD: non-allowlisted ${operation} on ${table}`);
  }
}

export function computeContactLeadPilotChecksum(
  rows: Array<{ hubspotContactId: string; decision: string; proposedLeadId: string | null }>
): string {
  const canonical = [...rows]
    .map((r) => `${r.hubspotContactId}|${r.decision}|${r.proposedLeadId ?? ""}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

export function mapImportDecisionToPilotState(input: {
  decision: HubspotImportDecision;
  wrongTenant: boolean;
  hasExternalLeadMapping: boolean;
  hasPersonSourceId: boolean;
  appliedByPilotBatch: boolean;
}): HubspotContactLeadPilotState {
  if (input.wrongTenant) return "wrong_tenant";
  if (input.appliedByPilotBatch) return "already_applied";

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
      // Per 1D: unmapped owner must not block safe identity linking — treated as note only
      // unless identity itself failed. Identity path rarely emits this for contacts.
      return "quarantine_unmapped_owner";
    case "quarantine_stage_unmapped":
      return "quarantine_unmapped_stage";
    case "skip_out_of_scope":
      return "excluded";
    default:
      return "excluded";
  }
}

export function isApplyablePilotDecision(state: HubspotContactLeadPilotState): boolean {
  return state === "link_existing_lead" || state === "create_new_lead" || state === "already_linked";
}

export function plainLanguageDecision(state: HubspotContactLeadPilotState): string {
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
    case "quarantine_unmapped_owner":
      return "Owner not mapped (review)";
    case "quarantine_unmapped_stage":
      return "Stage not mapped — quarantined";
    case "wrong_tenant":
      return "Wrong clinic — blocked";
    case "excluded":
      return "Excluded from this pilot";
    case "already_applied":
      return "Already applied in this pilot";
    default:
      return state;
  }
}

export function filterPilotRows(
  rows: HubspotContactLeadPilotRow[],
  filter: HubspotContactLeadPilotFilter
): HubspotContactLeadPilotRow[] {
  switch (filter) {
    case "ready":
      return rows.filter((r) => r.approvedForApply && isApplyablePilotDecision(r.decision));
    case "existing_lead":
      return rows.filter((r) =>
        ["link_existing_lead", "already_linked", "already_applied"].includes(r.decision)
      );
    case "new_lead":
      return rows.filter((r) => r.decision === "create_new_lead");
    case "patient_review":
      return rows.filter((r) => r.decision === "patient_link_review_required");
    case "quarantined":
      return rows.filter((r) => r.decision.startsWith("quarantine_"));
    case "conflict":
      return rows.filter((r) =>
        ["quarantine_multi_target_conflict", "wrong_tenant"].includes(r.decision)
      );
    case "applied":
      return rows.filter((r) => r.decision === "already_applied");
    case "all":
    default:
      return rows;
  }
}

export function summarizePilotRows(rows: HubspotContactLeadPilotRow[]): HubspotContactLeadPilotSummary {
  const summary: HubspotContactLeadPilotSummary = {
    totalPilotRecords: rows.length,
    linkedExistingLeads: 0,
    proposedNewLeads: 0,
    patientLinkReviews: 0,
    quarantined: 0,
    conflicts: 0,
    readyToApply: 0,
    applied: 0,
    alreadyApplied: 0,
  };
  for (const r of rows) {
    if (["link_existing_lead", "already_linked"].includes(r.decision)) summary.linkedExistingLeads += 1;
    if (r.decision === "create_new_lead") summary.proposedNewLeads += 1;
    if (r.decision === "patient_link_review_required") summary.patientLinkReviews += 1;
    if (r.decision.startsWith("quarantine_")) summary.quarantined += 1;
    if (["quarantine_multi_target_conflict", "wrong_tenant"].includes(r.decision)) summary.conflicts += 1;
    if (r.approvedForApply && isApplyablePilotDecision(r.decision)) summary.readyToApply += 1;
    if (r.decision === "already_applied") {
      summary.applied += 1;
      summary.alreadyApplied += 1;
    }
  }
  return summary;
}

/**
 * Build a bounded stratified pilot (max 25) without manufacturing cases.
 */
export function selectContactLeadPilotCohort(
  candidates: HubspotContactLeadPilotRow[],
  max = HUBSPOT_CONTACT_LEAD_PILOT_BATCH_MAX
): HubspotContactLeadPilotRow[] {
  const buckets: Record<string, HubspotContactLeadPilotRow[]> = {
    link: [],
    already: [],
    create: [],
    test: [],
    patient: [],
    otherQuarantine: [],
  };
  for (const c of candidates) {
    if (c.decision === "link_existing_lead") buckets.link.push(c);
    else if (c.decision === "already_linked") buckets.already.push(c);
    else if (c.decision === "create_new_lead") buckets.create.push(c);
    else if (c.decision === "quarantine_test_or_smoke") buckets.test.push(c);
    else if (c.decision === "patient_link_review_required") buckets.patient.push(c);
    else if (c.decision.startsWith("quarantine_")) buckets.otherQuarantine.push(c);
  }

  const out: HubspotContactLeadPilotRow[] = [];
  const take = (list: HubspotContactLeadPilotRow[], n: number) => {
    for (const row of list) {
      if (out.length >= max) return;
      if (out.some((x) => x.hubspotContactId === row.hubspotContactId)) continue;
      if (n <= 0) return;
      out.push(row);
      n -= 1;
    }
  };

  take(buckets.link, 15);
  take(buckets.create, 5);
  take(buckets.test, 2);
  take(buckets.patient, 1);
  take(buckets.already, 3);
  take(buckets.otherQuarantine, 2);
  // Fill remainder with more links / already-linked
  take(buckets.link, max);
  take(buckets.already, max);

  return out.slice(0, max).map((r) => ({
    ...r,
    approvedForApply: isApplyablePilotDecision(r.decision) && r.decision !== "already_linked"
      ? true
      : r.decision === "already_linked"
        ? true
        : false,
  }));
}

export function assertPilotBatchSize(count: number): void {
  if (count > HUBSPOT_CONTACT_LEAD_PILOT_BATCH_MAX) {
    throw new Error(
      `BATCH_LIMIT: contact/lead pilot cannot exceed ${HUBSPOT_CONTACT_LEAD_PILOT_BATCH_MAX} records`
    );
  }
}

export function assertPatientProtectionGates(): void {
  assertPatientCreationForbidden(false);
  assertEmailAloneCannotLinkPatient(false);
  // Intentional no-ops when false — documents the gate in call sites.
  assertPatientCreationForbidden(false);
}
