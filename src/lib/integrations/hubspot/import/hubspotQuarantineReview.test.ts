import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HUBSPOT_QUARANTINE_EXPECTED_COHORT_SIZE,
  HUBSPOT_QUARANTINE_FIXED_INVENTORY_CHECKSUM,
  HUBSPOT_QUARANTINE_FROZEN_CONTACT_IDS,
  HUBSPOT_QUARANTINE_FROZEN_EXCLUDED_IDS,
  HUBSPOT_QUARANTINE_FROZEN_QUARANTINED_IDS,
  HUBSPOT_QUARANTINE_INVENTORY_CHECKSUM_CONTRACT_VERSION,
  HUBSPOT_QUARANTINE_ORIGINAL_EXPECTED_V1_INVENTORY_CHECKSUM,
  HUBSPOT_QUARANTINE_PRIOR_LIVE_V1_INVENTORY_CHECKSUM,
  assertNoProductionMutationAllowlist,
  assertQuarantineBucketIds,
  assertQuarantineCohortIds,
  assertQuarantineReviewChecksum,
  buildQuarantineReconciliation,
  classifyQuarantineReview,
  computeQuarantineReviewChecksum,
  emptyQuarantineChecks,
  isAuthorizedQuarantineReviewRole,
  maskDisplayName,
  summarizeQuarantineReview,
  type HubspotQuarantineEvidenceChecks,
  type HubspotQuarantineReviewRow,
} from "./hubspotQuarantineReviewCore";

const checks = (
  partial: Partial<HubspotQuarantineEvidenceChecks> = {}
): HubspotQuarantineEvidenceChecks => ({
  ...emptyQuarantineChecks(),
  ...partial,
});

function classified(
  partialChecks: Partial<HubspotQuarantineEvidenceChecks> = {},
  overrides: Partial<{
    originalBucket: "quarantined" | "excluded";
    originalDecision: string;
    originalReasonCode: string;
    emailPresent: boolean;
    phonePresent: boolean;
    id: string;
  }> = {}
): HubspotQuarantineReviewRow {
  return {
    ...classifyQuarantineReview({
      hubspotContactId: overrides.id ?? "100040617619",
      displayNameMasked: "T*** U***",
      emailPresent: overrides.emailPresent ?? true,
      phonePresent: overrides.phonePresent ?? false,
      originalBucket: overrides.originalBucket ?? "quarantined",
      originalDecision: overrides.originalDecision ?? "quarantine_test_or_smoke",
      originalReasonCode: overrides.originalReasonCode ?? "excluded_test_or_smoke_identity",
      checks: checks(partialChecks),
    }),
    sourceUpdatedAt: "2026-07-14T12:00:00.000Z",
    sourcePayloadChecksum: "payload-q",
  };
}

describe("FI-HUBSPOT-IMPORT-1E-Q quarantine classification", () => {
  it("freezes the approved v2 inventory checksum and preserves v1 history", () => {
    assert.equal(
      HUBSPOT_QUARANTINE_INVENTORY_CHECKSUM_CONTRACT_VERSION,
      "fi-hubspot-contact-inventory-v2"
    );
    assert.equal(
      HUBSPOT_QUARANTINE_FIXED_INVENTORY_CHECKSUM,
      "1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b"
    );
    assert.equal(
      HUBSPOT_QUARANTINE_ORIGINAL_EXPECTED_V1_INVENTORY_CHECKSUM,
      "fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6"
    );
    assert.equal(
      HUBSPOT_QUARANTINE_PRIOR_LIVE_V1_INVENTORY_CHECKSUM,
      "b12aacbc38ce43f524e9867bdbb1efae0e8a555f1e05836f9e95319dae2a696a"
    );
    assert.notEqual(
      HUBSPOT_QUARANTINE_FIXED_INVENTORY_CHECKSUM,
      HUBSPOT_QUARANTINE_ORIGINAL_EXPECTED_V1_INVENTORY_CHECKSUM
    );
  });

  it("freezes exact 110 IDs and rejects cohort drift", () => {
    assert.equal(HUBSPOT_QUARANTINE_FROZEN_QUARANTINED_IDS.length, 100);
    assert.equal(HUBSPOT_QUARANTINE_FROZEN_EXCLUDED_IDS.length, 10);
    assert.equal(
      HUBSPOT_QUARANTINE_FROZEN_CONTACT_IDS.length,
      HUBSPOT_QUARANTINE_EXPECTED_COHORT_SIZE
    );
    assert.doesNotThrow(() =>
      assertQuarantineCohortIds([...HUBSPOT_QUARANTINE_FROZEN_CONTACT_IDS])
    );
    assert.throws(() => assertQuarantineCohortIds(["1", "2"]), /cohort drift/);
    assert.throws(
      () =>
        assertQuarantineBucketIds({
          quarantinedIds: ["1"],
          excludedIds: [...HUBSPOT_QUARANTINE_FROZEN_EXCLUDED_IDS],
        }),
      /bucket drift/
    );
  });

  it("authorizes configuration roles and rejects ordinary staff", () => {
    assert.equal(isAuthorizedQuarantineReviewRole("clinic_admin"), true);
    assert.equal(isAuthorizedQuarantineReviewRole("platform_admin"), true);
    assert.equal(isAuthorizedQuarantineReviewRole("reception"), false);
    assert.equal(isAuthorizedQuarantineReviewRole("surgeon"), false);
  });

  it("masks display names without exposing full identity", () => {
    assert.equal(maskDisplayName("Alice Smith"), "A*** S***");
    assert.equal(maskDisplayName(""), "(unnamed)");
  });

  it("retains test/smoke and ambiguous identity with explicit reasons", () => {
    assert.equal(classified({ testOrSmoke: true }).state, "retained_test_or_smoke");
    assert.equal(
      classified(
        { exactEmailPersonIds: ["p1", "p2"] },
        {
          originalDecision: "quarantine_ambiguous_identity",
          originalReasonCode: "email_matches_multiple_persons",
        }
      ).state,
      "retained_ambiguous_identity"
    );
  });

  it("reclassifies deterministic lead/create/patient candidates without apply", () => {
    const lead = classified({
      existingPersonSourceId: "person-1",
      uniqueLeadCandidateId: "lead-1",
    });
    assert.equal(lead.state, "reclassify_existing_lead_link");
    assert.equal(lead.approvedForApply, false);
    assert.equal(lead.possibleLegitimateContact, true);

    const create = classified({
      testOrSmoke: false,
      spamOrJunk: false,
    });
    assert.equal(create.state, "reclassify_create_candidate");
    assert.equal(create.approvedForApply, false);

    const patient = classified({
      exactEmailPatientIds: ["patient-1"],
      patientWarning: true,
    });
    assert.equal(patient.state, "reclassify_patient_review");
    assert.equal(patient.approvedForApply, false);
  });

  it("excludes archived contacts with an explicit archived reason", () => {
    const row = classified(
      { archived: true },
      {
        originalBucket: "excluded",
        originalDecision: "excluded",
        originalReasonCode: "archived_hubspot_contact_policy_skip",
      }
    );
    assert.equal(row.state, "excluded_archived_without_business_value");
    assert.match(row.reasonCode, /archived/);
  });

  it("defaults to deferred when evidence is incomplete", () => {
    const row = classified({ sourceFresh: false, sourceAfterCutoff: true });
    assert.equal(row.state, "deferred_manual_review");
    assert.match(row.reasonCode, /freshness|incomplete|cutoff/i);
  });

  it("fail-closes wrong tenant and forbids production mutation tables", () => {
    assert.equal(classified({ sameTenant: false }).state, "excluded_with_reason");
    assert.throws(() => assertNoProductionMutationAllowlist("fi_crm_leads", "insert"), /forbidden/);
    assert.throws(
      () => assertNoProductionMutationAllowlist("fi_external_record_mappings", "insert"),
      /forbidden/
    );
    assert.doesNotThrow(() =>
      assertNoProductionMutationAllowlist("fi_hubspot_contact_lead_pilot_decisions", "insert")
    );
  });

  it("reconciles exactly 4752 with retained + reclassified + deferred partitions", () => {
    const rows = [
      classified({ testOrSmoke: true }, { id: "1918501" }),
      classified(
        { archived: true },
        {
          id: "209718675563",
          originalBucket: "excluded",
          originalDecision: "excluded",
          originalReasonCode: "archived_hubspot_contact_policy_skip",
        }
      ),
      classified({ uniqueLeadCandidateId: "lead-9" }, { id: "100040617619" }),
    ];
    // Pad with retained rows to prove math (not full cohort).
    const summary = summarizeQuarantineReview(rows);
    assert.equal(summary.retainedCount + summary.excludedCount, 2);
    assert.equal(summary.reclassifiedCount, 1);

    const recon = buildQuarantineReconciliation({
      mapped: 4606,
      deferredCreate: 31,
      duplicateRiskCreate: 1,
      deferredPatientReview: 4,
      rows: Array.from({ length: 110 }, (_, i) =>
        classified({ testOrSmoke: true }, { id: String(HUBSPOT_QUARANTINE_FROZEN_CONTACT_IDS[i]) })
      ),
    });
    assert.equal(recon.total, 4752);
    assert.equal(recon.unexplained, 0);
    assert.equal(recon.wrongTenant, 0);
    assert.equal(recon.balanced, true);
  });

  it("computes stable review checksums and rejects stale checksums", () => {
    const rows = [
      classified({ testOrSmoke: true }, { id: "1918501" }),
      classified({ testOrSmoke: true }, { id: "1938151" }),
    ];
    const a = computeQuarantineReviewChecksum(rows);
    const b = computeQuarantineReviewChecksum([...rows].reverse());
    assert.equal(a, b);
    assert.throws(() => assertQuarantineReviewChecksum(a, "deadbeef"), /stale or mutated/);
  });

  it("rejects vague generic outcomes by requiring explicit reason codes", () => {
    const row = classified({ testOrSmoke: true });
    assert.notEqual(row.reasonCode, "other");
    assert.notEqual(row.reasonCode, "unknown");
    assert.notEqual(row.reasonCode, "n/a");
    assert.ok(row.reasonCode.length > 8);
    assert.ok(row.plainLanguageEvidence.length >= 1);
  });
});
