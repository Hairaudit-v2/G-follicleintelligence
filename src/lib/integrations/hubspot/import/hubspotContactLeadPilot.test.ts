import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertEmailAloneCannotLinkPatient,
  assertPatientCreationForbidden,
  planPersonMetadataEnrichment,
  stageFillAllowed,
} from "./hubspotContactLeadFieldPolicy";
import {
  assertContactLeadMutationAllowlist,
  assertPilotBatchSize,
  computeContactLeadPilotChecksum,
  filterPilotRows,
  isApplyablePilotDecision,
  mapImportDecisionToPilotState,
  plainLanguageDecision,
  selectContactLeadPilotCohort,
  summarizePilotRows,
} from "./hubspotContactLeadPilotCore";
import type { HubspotContactLeadPilotRow } from "./hubspotContactLeadPilotTypes";
import { wouldRegressFiStage } from "./hubspotImportMappingV1";

function row(partial: Partial<HubspotContactLeadPilotRow>): HubspotContactLeadPilotRow {
  return {
    hubspotContactId: "1",
    displayName: "Contact",
    email: "a@example.com",
    phone: null,
    decision: "link_existing_lead",
    reasonCode: "person_source_id_single_lead",
    matchEvidence: "person_source_id_single_lead",
    proposedLeadId: "lead-1",
    proposedLeadLabel: "Lead",
    hubspotOwnerId: null,
    ownerResolutionStatus: "none",
    sourceStageLabel: null,
    mappedFiStageSlug: null,
    patientProtectionWarning: null,
    quarantineReason: null,
    lastSourceActivityAt: null,
    approvedForApply: true,
    identityTier: "tier2_explicit_hubspot_ref",
    ...partial,
  };
}

describe("hubspotContactLeadPilot 1D", () => {
  it("blocks automatic patient creation", () => {
    assert.throws(() => assertPatientCreationForbidden(true));
    assert.doesNotThrow(() => assertPatientCreationForbidden(false));
  });

  it("blocks email-only patient link", () => {
    assert.throws(() => assertEmailAloneCannotLinkPatient(true));
  });

  it("maps patient evidence to patient_link_review_required", () => {
    assert.equal(
      mapImportDecisionToPilotState({
        decision: "quarantine_patient_link_requires_stronger_evidence",
        wrongTenant: false,
        hasExternalLeadMapping: false,
        hasPersonSourceId: false,
        appliedByPilotBatch: false,
      }),
      "patient_link_review_required"
    );
    assert.equal(
      mapImportDecisionToPilotState({
        decision: "link_existing_patient",
        wrongTenant: false,
        hasExternalLeadMapping: false,
        hasPersonSourceId: true,
        appliedByPilotBatch: false,
      }),
      "patient_link_review_required"
    );
  });

  it("patient review is not applyable", () => {
    assert.equal(isApplyablePilotDecision("patient_link_review_required"), false);
    assert.equal(isApplyablePilotDecision("link_existing_lead"), true);
  });

  it("preserves native email and fills blank name", () => {
    const planned = planPersonMetadataEnrichment({
      existing: { email_normalized: "native@clinic.org", first_name: "" },
      sourceFirstName: "Ada",
      sourceLastName: "Lovelace",
      sourceEmailNormalized: "hubspot@other.org",
      sourcePhone: null,
    });
    assert.equal(planned.next.email_normalized, "native@clinic.org");
    assert.equal(planned.next.first_name, "Ada");
    assert.ok(planned.changedKeys.includes("first_name"));
    assert.ok(!planned.changedKeys.includes("email_normalized"));
  });

  it("blocks stage regression", () => {
    assert.equal(wouldRegressFiStage("won_closed", "contacted"), true);
    assert.equal(
      stageFillAllowed({
        currentFiSlug: "won_closed",
        proposedFiSlug: "contacted",
        wouldRegress: true,
        historyOnly: false,
      }),
      false
    );
  });

  it("enforces batch max 25", () => {
    assert.throws(() => assertPilotBatchSize(26));
    assert.doesNotThrow(() => assertPilotBatchSize(25));
  });

  it("blocks non-allowlisted mutations including patients", () => {
    assert.throws(() => assertContactLeadMutationAllowlist("fi_patients", "insert"));
    assert.throws(() => assertContactLeadMutationAllowlist("fi_staff", "update"));
    assert.throws(() => assertContactLeadMutationAllowlist("fi_users", "insert"));
    assert.doesNotThrow(() =>
      assertContactLeadMutationAllowlist("fi_external_record_mappings", "insert")
    );
  });

  it("checksum changes when decisions change", () => {
    const a = computeContactLeadPilotChecksum([
      { hubspotContactId: "1", decision: "link_existing_lead", proposedLeadId: "L1" },
    ]);
    const b = computeContactLeadPilotChecksum([
      { hubspotContactId: "1", decision: "link_existing_lead", proposedLeadId: "L2" },
    ]);
    assert.notEqual(a, b);
  });

  it("cohort prefers links and keeps size <= 25", () => {
    const candidates = [
      ...Array.from({ length: 40 }, (_, i) =>
        row({ hubspotContactId: `L${i}`, decision: "link_existing_lead" })
      ),
      row({ hubspotContactId: "T1", decision: "quarantine_test_or_smoke", approvedForApply: false }),
      row({ hubspotContactId: "T2", decision: "quarantine_test_or_smoke", approvedForApply: false }),
      row({
        hubspotContactId: "P1",
        decision: "patient_link_review_required",
        approvedForApply: false,
      }),
    ];
    const cohort = selectContactLeadPilotCohort(candidates, 25);
    assert.ok(cohort.length <= 25);
    assert.ok(cohort.some((c) => c.decision === "quarantine_test_or_smoke"));
    assert.ok(cohort.filter((c) => c.decision === "link_existing_lead").length >= 10);
  });

  it("plain language distinguishes existing vs new lead", () => {
    assert.equal(plainLanguageDecision("link_existing_lead"), "Link to existing lead");
    assert.equal(plainLanguageDecision("create_new_lead"), "Create new lead");
  });

  it("filters ready vs patient review", () => {
    const rows = [
      row({ decision: "link_existing_lead", approvedForApply: true }),
      row({
        hubspotContactId: "2",
        decision: "patient_link_review_required",
        approvedForApply: false,
      }),
    ];
    assert.equal(filterPilotRows(rows, "ready").length, 1);
    assert.equal(filterPilotRows(rows, "patient_review").length, 1);
    assert.equal(summarizePilotRows(rows).patientLinkReviews, 1);
  });

  it("wrong tenant maps correctly", () => {
    assert.equal(
      mapImportDecisionToPilotState({
        decision: "conflict_multiple_targets",
        wrongTenant: true,
        hasExternalLeadMapping: false,
        hasPersonSourceId: false,
        appliedByPilotBatch: false,
      }),
      "wrong_tenant"
    );
  });
});
