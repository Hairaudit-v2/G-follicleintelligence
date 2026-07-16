import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HubspotContactLeadExpansionRow } from "./hubspotContactLeadExpansionTypes";
import {
  HUBSPOT_LEAD_CANDIDATE_BATCH_MAX,
  assertLeadCandidateBatchSize,
  classifyLeadCandidate,
  computeLeadCandidateReviewChecksum,
  deferBeyondFirstBatch,
  type HubspotLeadCandidateReviewChecks,
} from "./hubspotLeadCandidateReviewCore";

const row = (partial: Partial<HubspotContactLeadExpansionRow> = {}): HubspotContactLeadExpansionRow => ({
  hubspotContactId: "1001",
  displayName: "Safe Candidate",
  email: "safe@example.org",
  phone: "0412345678",
  decision: "create_new_lead",
  reasonCode: "no_deterministic_match_propose_new_lead",
  matchEvidence: "none",
  proposedLeadId: null,
  proposedLeadLabel: null,
  hubspotOwnerId: null,
  ownerResolutionStatus: "unmapped",
  sourceStageLabel: null,
  mappedFiStageSlug: null,
  patientProtectionWarning: null,
  quarantineReason: null,
  lastSourceActivityAt: "2026-07-16T12:00:00.000Z",
  approvedForApply: false,
  identityTier: "none",
  applyEligible: false,
  ...partial,
});

const checks = (
  partial: Partial<HubspotLeadCandidateReviewChecks> = {}
): HubspotLeadCandidateReviewChecks => ({
  sameTenant: true,
  sourceFresh: true,
  archived: false,
  existingMappingLeadId: null,
  existingPersonSourceId: null,
  existingPatientSourceId: null,
  exactEmailPersonIds: [],
  exactPhonePersonIds: [],
  duplicateCandidateEmail: false,
  duplicateCandidatePhone: false,
  validEmail: true,
  validPhone: true,
  possibleSpam: false,
  ...partial,
});

describe("FI-HUBSPOT-IMPORT-1E-C candidate review", () => {
  it("approves only unique same-tenant identity at the fixed cutoff", () => {
    const result = classifyLeadCandidate({ row: row(), checks: checks() });
    assert.equal(result.state, "approved_create_new_lead");
    assert.equal(result.approvedForApply, true);
  });

  it("fails patient, duplicate, wrong-tenant and stale records closed", () => {
    assert.equal(
      classifyLeadCandidate({
        row: row(),
        checks: checks({ existingPatientSourceId: "patient-1" }),
      }).state,
      "patient_link_review_required"
    );
    assert.equal(
      classifyLeadCandidate({
        row: row(),
        checks: checks({ duplicateCandidateEmail: true }),
      }).state,
      "quarantine_duplicate_risk"
    );
    assert.equal(
      classifyLeadCandidate({ row: row(), checks: checks({ sameTenant: false }) }).state,
      "excluded"
    );
    assert.equal(
      classifyLeadCandidate({ row: row(), checks: checks({ sourceFresh: false }) }).state,
      "deferred_manual_review"
    );
  });

  it("never creates a duplicate person from exact email or phone", () => {
    assert.equal(
      classifyLeadCandidate({
        row: row(),
        checks: checks({ exactEmailPersonIds: ["person-1"] }),
      }).state,
      "deferred_manual_review"
    );
    assert.equal(
      classifyLeadCandidate({
        row: row(),
        checks: checks({ exactPhonePersonIds: ["person-1"] }),
      }).state,
      "deferred_manual_review"
    );
  });

  it("caps the first creation batch at ten without auto-approving all", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      ...classifyLeadCandidate({
        row: row({ hubspotContactId: String(index + 1).padStart(3, "0") }),
        checks: checks(),
      }),
      sourceUpdatedAt: "2026-07-16T12:00:00.000Z",
      sourcePayloadChecksum: `checksum-${index}`,
      inventoryReasonCode: "no_deterministic_match_propose_new_lead",
    }));
    const bounded = deferBeyondFirstBatch(rows);
    assert.equal(
      bounded.filter((candidate) => candidate.approvedForApply).length,
      HUBSPOT_LEAD_CANDIDATE_BATCH_MAX
    );
    assert.equal(
      bounded.filter((candidate) => candidate.state === "deferred_manual_review").length,
      2
    );
    assert.doesNotThrow(() => assertLeadCandidateBatchSize(10));
    assert.throws(() => assertLeadCandidateBatchSize(11), /BATCH_LIMIT/);
  });

  it("produces a deterministic review checksum", () => {
    const reviewed = {
      ...classifyLeadCandidate({ row: row(), checks: checks() }),
      sourceUpdatedAt: "2026-07-16T12:00:00.000Z",
      sourcePayloadChecksum: "abc",
      inventoryReasonCode: "no_deterministic_match_propose_new_lead",
    };
    assert.equal(
      computeLeadCandidateReviewChecksum([reviewed]),
      computeLeadCandidateReviewChecksum([reviewed])
    );
  });
});
