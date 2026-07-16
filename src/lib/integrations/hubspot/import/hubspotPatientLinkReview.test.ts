import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HUBSPOT_PATIENT_LINK_BATCH_MAX,
  HUBSPOT_PATIENT_LINK_FROZEN_CONTACT_IDS,
  assertExplicitPatientLinkApplyApproval,
  assertIdempotencyAndRollbackPolicy,
  assertNoPatientMutationAllowlist,
  assertPatientLinkBatchSize,
  assertPatientLinkCohortIds,
  assertPatientLinkPreviewChecksum,
  buildPatientLinkMutationPlan,
  capApprovedPatientLinks,
  classifyPatientLinkReview,
  computePatientLinkReviewChecksum,
  isAuthorizedPatientLinkReviewRole,
  maskDisplayName,
  type HubspotPatientLinkEvidenceChecks,
  type HubspotPatientLinkReviewRow,
} from "./hubspotPatientLinkReviewCore";

const checks = (
  partial: Partial<HubspotPatientLinkEvidenceChecks> = {}
): HubspotPatientLinkEvidenceChecks => ({
  sameTenant: true,
  sourceFresh: true,
  archived: false,
  existingContactLeadMappingId: null,
  existingContactPatientMappingId: null,
  existingPatientSourceId: null,
  existingPersonSourceId: null,
  proposedOrMappedLeadId: null,
  trustedLeadPatientId: null,
  exactEmailPatientIds: [],
  exactPhonePatientIds: [],
  exactEmailPersonIds: [],
  exactPhonePersonIds: [],
  appointmentAssociationPatientIds: [],
  clinicalAssociationPatientIds: [],
  matchedReliableIdentifiers: [],
  missingReliableIdentifiers: [
    "hubspot_patient_source_id",
    "hubspot_person_source_id",
    "exact_email",
    "exact_phone",
    "trusted_lead_patient_relationship",
  ],
  weakOnlySignals: [],
  conflicts: [],
  possiblePatientTargets: [],
  hasClinicalNotesExposureRisk: false,
  ...partial,
});

function classified(
  partialChecks: Partial<HubspotPatientLinkEvidenceChecks> = {},
  id = "229708595090"
): HubspotPatientLinkReviewRow {
  return {
    ...classifyPatientLinkReview({
      hubspotContactId: id,
      displayNameMasked: "A*** B***",
      emailPresent: true,
      phonePresent: false,
      inventoryReasonCode: "email_matches_patient_without_stronger_evidence",
      checks: checks(partialChecks),
    }),
    sourceUpdatedAt: "2026-07-14T16:43:16.224Z",
    sourcePayloadChecksum: "payload-abc",
    inventoryReasonCode: "email_matches_patient_without_stronger_evidence",
  };
}

describe("FI-HUBSPOT-IMPORT-1E-P patient-link review", () => {
  it("defaults to deferred when evidence is insufficient", () => {
    const row = classified();
    assert.equal(row.state, "deferred_clinical_identity_review");
    assert.equal(row.approvedForApply, false);
  });

  it("never approves email-only, phone-only, name-only, fuzzy, household, or timing", () => {
    assert.equal(
      classified({
        exactEmailPatientIds: ["patient-1"],
        matchedReliableIdentifiers: ["exact_email"],
        weakOnlySignals: ["exact_email"],
      }).state,
      "deferred_clinical_identity_review"
    );
    assert.equal(
      classified({
        exactPhonePatientIds: ["patient-1"],
        matchedReliableIdentifiers: ["exact_phone"],
        weakOnlySignals: ["exact_phone"],
      }).reasonCode,
      "phone_only_never_approves_patient_link"
    );
    assert.equal(
      classified({
        weakOnlySignals: ["name_only", "fuzzy", "shared_household", "owner_stage_timing"],
      }).state,
      "deferred_clinical_identity_review"
    );
  });

  it("approves only with trusted lead→patient or ≥2 reliable identifiers", () => {
    const trusted = classified({
      trustedLeadPatientId: "patient-1",
      proposedOrMappedLeadId: "lead-1",
      matchedReliableIdentifiers: ["trusted_lead_patient_relationship"],
    });
    assert.equal(
      trusted.state,
      "link_existing_lead_patient_relationship_already_trusted"
    );
    assert.equal(trusted.approvedForApply, true);

    const dual = classified({
      exactEmailPatientIds: ["patient-2"],
      exactPhonePatientIds: ["patient-2"],
      matchedReliableIdentifiers: ["exact_email", "exact_phone"],
    });
    assert.equal(dual.state, "approved_link_existing_patient");
    assert.equal(dual.approvedForApply, true);
  });

  it("fail-closes multi-patient, ambiguous, wrong-tenant, and archived cases", () => {
    assert.equal(
      classified({
        exactEmailPatientIds: ["p1"],
        exactPhonePatientIds: ["p2"],
      }).state,
      "quarantine_multi_patient_conflict"
    );
    assert.equal(
      classified({ conflicts: ["email_and_phone_point_to_different_patients"] }).state,
      "quarantine_ambiguous_patient_identity"
    );
    assert.equal(
      classified({ sameTenant: false }).state,
      "excluded_non_patient"
    );
    assert.equal(
      classified({ archived: true }).state,
      "excluded_non_patient"
    );
  });

  it("marks already-resolved patient identity without proposing a new link", () => {
    const row = classified({
      existingPatientSourceId: "patient-9",
      matchedReliableIdentifiers: ["hubspot_patient_source_id"],
    });
    assert.equal(row.state, "already_resolved");
    assert.equal(row.approvedForApply, false);
  });

  it("enforces cohort freeze, batch max 2, and role/tenant checks", () => {
    assert.doesNotThrow(() =>
      assertPatientLinkCohortIds([...HUBSPOT_PATIENT_LINK_FROZEN_CONTACT_IDS])
    );
    assert.throws(() => assertPatientLinkCohortIds(["1", "2", "3", "999"]), /cohort drift/);
    assert.doesNotThrow(() => assertPatientLinkBatchSize(2));
    assert.throws(() => assertPatientLinkBatchSize(3), /BATCH_LIMIT/);
    assert.equal(isAuthorizedPatientLinkReviewRole("clinic_admin"), true);
    assert.equal(isAuthorizedPatientLinkReviewRole("surgeon"), true);
    assert.equal(isAuthorizedPatientLinkReviewRole("reception"), false);
  });

  it("caps approved links at batch max and builds a zero-link mutation plan when deferred", () => {
    const rows = [
      classified(
        {
          exactEmailPatientIds: ["p1"],
          exactPhonePatientIds: ["p1"],
          matchedReliableIdentifiers: ["exact_email", "exact_phone"],
        },
        "229708595090"
      ),
      classified(
        {
          exactEmailPatientIds: ["p2"],
          exactPhonePatientIds: ["p2"],
          matchedReliableIdentifiers: ["exact_email", "exact_phone"],
        },
        "233738855995"
      ),
      classified(
        {
          exactEmailPatientIds: ["p3"],
          exactPhonePatientIds: ["p3"],
          matchedReliableIdentifiers: ["exact_email", "exact_phone"],
        },
        "234062240678"
      ),
    ];
    const capped = capApprovedPatientLinks(rows);
    assert.equal(
      capped.filter((row) => row.approvedForApply).length,
      HUBSPOT_PATIENT_LINK_BATCH_MAX
    );
    const deferredPlan = buildPatientLinkMutationPlan([
      classified(),
      classified({}, "233738855995"),
      classified({}, "234062240678"),
      classified({}, "234339716176"),
    ]);
    assert.equal(deferredPlan.proposedProductionLinks, 0);
    assert.equal(deferredPlan.patientProtection.createPatientForbidden, true);
  });

  it("blocks apply without explicit approval, rejects stale checksums, and guards mutations", () => {
    assert.throws(
      () =>
        assertExplicitPatientLinkApplyApproval({
          explicitHumanApproval: false,
          approvalToken: null,
          expectedToken: "abc",
        }),
      /APPROVAL_GATE/
    );
    assert.throws(
      () => assertPatientLinkPreviewChecksum("a", "b"),
      /stale or mutated/
    );
    assert.throws(
      () => assertNoPatientMutationAllowlist("fi_patients", "insert"),
      /PATIENT_GUARD/
    );
    assert.throws(
      () =>
        assertIdempotencyAndRollbackPolicy({
          applyExecuted: true,
          rollbackAllowedWithoutApply: true,
        }),
      /IDEMPOTENCY_GUARD/
    );
    assert.doesNotThrow(() =>
      assertIdempotencyAndRollbackPolicy({
        applyExecuted: false,
        rollbackAllowedWithoutApply: true,
      })
    );
  });

  it("produces a deterministic review checksum and masks display names", () => {
    const row = classified();
    assert.equal(
      computePatientLinkReviewChecksum([row]),
      computePatientLinkReviewChecksum([row])
    );
    assert.match(maskDisplayName("Jane Doe"), /\*\*\*/);
    assert.doesNotMatch(maskDisplayName("Jane Doe"), /Jane Doe/);
  });

  it("retains CRM lead only when mapped lead exists without patient identity", () => {
    const row = classified({
      existingContactLeadMappingId: "lead-mapped",
      proposedOrMappedLeadId: "lead-mapped",
    });
    assert.equal(row.state, "retain_crm_lead_only");
    assert.equal(row.approvedForApply, false);
  });
});
