import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertEmailAloneCannotLinkPatient,
  assertPatientCreationForbidden,
  planPersonMetadataEnrichment,
} from "./hubspotContactLeadFieldPolicy";
import {
  assertBackupWatermarkNotAllowlisted,
  assertChangedContactIdentitySafe,
  assertCoverageReconciled,
  assertExpansionBatchSize,
  assertExpansionMutationAllowlist,
  assertPriorBatchReconciled,
  assertReconciliationBalanced,
  buildBatchReconciliation,
  computeExpansionChecksum,
  computeInventorySignature,
  detectDuplicateNewLeadRisk,
  diffInventorySignatures,
  filterExpansionRows,
  isArchivedHubspotStagingContact,
  isApplyableExpansionDecision,
  mapImportDecisionToExpansionState,
  plainLanguageExpansionDecision,
  primaryActionForBatchStatus,
  profileExpansionDataQuality,
  reconcileContactCoverage,
  resolveExpansionBatchMax,
  selectNextExpansionBatch,
  summarizeExpansionInventory,
  toInventorySignatureRow,
} from "./hubspotContactLeadExpansionCore";
import type { HubspotContactLeadExpansionRow } from "./hubspotContactLeadExpansionTypes";
import {
  HUBSPOT_CONTACT_LEAD_EXPANSION_DEFAULT_BATCH_MAX,
  HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_BATCH_MAX,
  HUBSPOT_CONTACT_LEAD_EXPANSION_INITIAL_BATCH_MAX,
} from "./hubspotContactLeadExpansionTypes";

function row(partial: Partial<HubspotContactLeadExpansionRow>): HubspotContactLeadExpansionRow {
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
    ownerResolutionStatus: "none_deferred",
    sourceStageLabel: null,
    mappedFiStageSlug: null,
    patientProtectionWarning: null,
    quarantineReason: null,
    lastSourceActivityAt: null,
    approvedForApply: true,
    identityTier: "tier2_explicit_hubspot_ref",
    applyEligible: true,
    ...partial,
  };
}

describe("hubspotContactLeadExpansion 1E", () => {
  it("blocks automatic patient creation and email-only patient link", () => {
    assert.throws(() => assertPatientCreationForbidden(true));
    assert.throws(() => assertEmailAloneCannotLinkPatient(true));
  });

  it("maps patient evidence to patient_link_review_required and blocks apply", () => {
    assert.equal(
      mapImportDecisionToExpansionState({
        decision: "link_existing_patient",
        wrongTenant: false,
        hasExternalLeadMapping: false,
        hasPersonSourceId: true,
        appliedByExpansionOrPilot: false,
      }),
      "patient_link_review_required"
    );
    assert.equal(isApplyableExpansionDecision("patient_link_review_required"), false);
  });

  it("wrong tenant maps correctly", () => {
    assert.equal(
      mapImportDecisionToExpansionState({
        decision: "link_existing_lead",
        wrongTenant: true,
        hasExternalLeadMapping: false,
        hasPersonSourceId: false,
        appliedByExpansionOrPilot: false,
      }),
      "wrong_tenant"
    );
  });

  it("multi-target and duplicate states quarantine", () => {
    assert.equal(
      mapImportDecisionToExpansionState({
        decision: "conflict_multiple_targets",
        wrongTenant: false,
        hasExternalLeadMapping: false,
        hasPersonSourceId: false,
        appliedByExpansionOrPilot: false,
        duplicateTarget: true,
      }),
      "quarantine_duplicate_target"
    );
    assert.equal(
      mapImportDecisionToExpansionState({
        decision: "create_new_lead",
        wrongTenant: false,
        hasExternalLeadMapping: false,
        hasPersonSourceId: false,
        appliedByExpansionOrPilot: false,
        duplicateSource: true,
      }),
      "quarantine_duplicate_source"
    );
  });

  it("invalid contact and test/smoke quarantine", () => {
    assert.equal(
      mapImportDecisionToExpansionState({
        decision: "create_new_lead",
        wrongTenant: false,
        hasExternalLeadMapping: false,
        hasPersonSourceId: false,
        appliedByExpansionOrPilot: false,
        invalidContact: true,
      }),
      "quarantine_invalid_contact"
    );
    assert.equal(
      mapImportDecisionToExpansionState({
        decision: "quarantine_test_or_smoke",
        wrongTenant: false,
        hasExternalLeadMapping: false,
        hasPersonSourceId: false,
        appliedByExpansionOrPilot: false,
      }),
      "quarantine_test_or_smoke"
    );
  });

  it("blank source cannot erase FI email", () => {
    const planned = planPersonMetadataEnrichment({
      existing: { email_normalized: "native@clinic.org", first_name: "Ada" },
      sourceFirstName: "",
      sourceLastName: null,
      sourceEmailNormalized: null,
      sourcePhone: null,
    });
    assert.equal(planned.next.email_normalized, "native@clinic.org");
    assert.equal(planned.next.first_name, "Ada");
  });

  it("enforces batch size policy E1=100 then 250", () => {
    assert.equal(
      resolveExpansionBatchMax({
        batchSequence: 1,
        consecutiveReconciledStreak: 0,
        allowExpandedBatchSize: false,
      }),
      HUBSPOT_CONTACT_LEAD_EXPANSION_INITIAL_BATCH_MAX
    );
    assert.equal(
      resolveExpansionBatchMax({
        batchSequence: 2,
        consecutiveReconciledStreak: 1,
        allowExpandedBatchSize: false,
      }),
      HUBSPOT_CONTACT_LEAD_EXPANSION_DEFAULT_BATCH_MAX
    );
    assert.equal(
      resolveExpansionBatchMax({
        batchSequence: 4,
        consecutiveReconciledStreak: 3,
        allowExpandedBatchSize: true,
      }),
      HUBSPOT_CONTACT_LEAD_EXPANSION_EXPANDED_BATCH_MAX
    );
    assert.throws(() =>
      assertExpansionBatchSize(101, {
        batchSequence: 1,
        consecutiveReconciledStreak: 0,
        allowExpandedBatchSize: false,
      })
    );
    assert.doesNotThrow(() =>
      assertExpansionBatchSize(100, {
        batchSequence: 1,
        consecutiveReconciledStreak: 0,
        allowExpandedBatchSize: false,
      })
    );
  });

  it("blocks patient and staff mutations", () => {
    assert.throws(() => assertExpansionMutationAllowlist("fi_patients", "insert"));
    assert.throws(() => assertExpansionMutationAllowlist("fi_staff", "update"));
    assert.throws(() => assertExpansionMutationAllowlist("fi_users", "insert"));
    assert.doesNotThrow(() =>
      assertExpansionMutationAllowlist("fi_external_record_mappings", "insert")
    );
  });

  it("unreconciled prior batch blocks next", () => {
    assert.throws(() =>
      assertPriorBatchReconciled({
        priorBatch: {
          status: "import_completed",
          reconciliation: { balanced: false, unexplained: 2 },
        },
      })
    );
    assert.doesNotThrow(() =>
      assertPriorBatchReconciled({
        priorBatch: {
          status: "import_completed",
          reconciliation: { balanced: true, unexplained: 0 },
        },
      })
    );
    assert.doesNotThrow(() => assertPriorBatchReconciled({ priorBatch: null }));
  });

  it("reconciliation equation balances with unexplained 0", () => {
    const recon = buildBatchReconciliation({
      batchId: "b1",
      approvedRecords: 100,
      appliedMappings: 95,
      newLeads: 0,
      alreadyApplied: 5,
      quarantined: 0,
      excluded: 0,
      failedClosed: 0,
      leadCountBefore: 4706,
      leadCountAfter: 4706,
      patientCountBefore: 829,
      patientCountAfter: 829,
      sideEffects: [],
      watermarkBefore: "t1",
      watermarkAfter: "t1",
    });
    assert.equal(recon.unexplained, 0);
    assert.equal(recon.balanced, true);
    assert.doesNotThrow(() => assertReconciliationBalanced(recon));

    const bad = buildBatchReconciliation({
      batchId: "b2",
      approvedRecords: 100,
      appliedMappings: 90,
      newLeads: 0,
      alreadyApplied: 5,
      quarantined: 0,
      excluded: 0,
      failedClosed: 0,
      leadCountBefore: 4706,
      leadCountAfter: 4706,
      patientCountBefore: 829,
      patientCountAfter: 829,
      sideEffects: [],
      watermarkBefore: "t1",
      watermarkAfter: "t1",
    });
    assert.equal(bad.unexplained, 5);
    assert.throws(() => assertReconciliationBalanced(bad));
  });

  it("patient mutation and side effects fail reconcile", () => {
    assert.throws(() =>
      assertReconciliationBalanced(
        buildBatchReconciliation({
          batchId: "b3",
          approvedRecords: 1,
          appliedMappings: 1,
          newLeads: 0,
          alreadyApplied: 0,
          quarantined: 0,
          excluded: 0,
          failedClosed: 0,
          leadCountBefore: 1,
          leadCountAfter: 1,
          patientCountBefore: 1,
          patientCountAfter: 2,
          sideEffects: [],
          watermarkBefore: null,
          watermarkAfter: null,
        })
      )
    );
    assert.throws(() =>
      assertReconciliationBalanced(
        buildBatchReconciliation({
          batchId: "b4",
          approvedRecords: 1,
          appliedMappings: 1,
          newLeads: 0,
          alreadyApplied: 0,
          quarantined: 0,
          excluded: 0,
          failedClosed: 0,
          leadCountBefore: 1,
          leadCountAfter: 1,
          patientCountBefore: 1,
          patientCountAfter: 1,
          sideEffects: ["notification"],
          watermarkBefore: "a",
          watermarkAfter: "a",
        })
      )
    );
  });

  it("selectNextExpansionBatch prefers links and respects max", () => {
    const inventory = [
      ...Array.from({ length: 150 }, (_, i) =>
        row({
          hubspotContactId: `L${i}`,
          decision: "link_existing_lead",
          approvedForApply: true,
          applyEligible: true,
        })
      ),
      row({
        hubspotContactId: "C1",
        decision: "create_new_lead",
        approvedForApply: true,
        applyEligible: true,
      }),
      row({
        hubspotContactId: "P1",
        decision: "patient_link_review_required",
        approvedForApply: false,
        applyEligible: false,
      }),
    ];
    const batch = selectNextExpansionBatch(inventory, 100);
    assert.equal(batch.length, 100);
    assert.ok(batch.every((r) => r.decision === "link_existing_lead"));
  });

  it("detects duplicate new-lead risk", () => {
    assert.equal(
      detectDuplicateNewLeadRisk([
        { email: "a@x.com", displayName: "Ada", decision: "create_new_lead" },
        { email: "a@x.com", displayName: "Ada", decision: "create_new_lead" },
      ]),
      true
    );
    assert.equal(
      detectDuplicateNewLeadRisk([
        { email: "a@x.com", displayName: "Ada", decision: "create_new_lead" },
        { email: "b@x.com", displayName: "Bob", decision: "create_new_lead" },
      ]),
      false
    );
  });

  it("checksum changes when decisions change", () => {
    const a = computeExpansionChecksum([
      { hubspotContactId: "1", decision: "link_existing_lead", proposedLeadId: "L1" },
    ]);
    const b = computeExpansionChecksum([
      { hubspotContactId: "1", decision: "link_existing_lead", proposedLeadId: "L2" },
    ]);
    assert.notEqual(a, b);
  });

  it("filters and summary support remaining/completion", () => {
    const rows = [
      row({ decision: "link_existing_lead", approvedForApply: true }),
      row({
        hubspotContactId: "2",
        decision: "already_applied",
        approvedForApply: false,
        applyEligible: false,
      }),
      row({
        hubspotContactId: "3",
        decision: "quarantine_test_or_smoke",
        approvedForApply: false,
        applyEligible: false,
      }),
      row({
        hubspotContactId: "4",
        decision: "patient_link_review_required",
        approvedForApply: false,
        applyEligible: false,
      }),
    ];
    assert.equal(filterExpansionRows(rows, "ready").length, 1);
    assert.equal(filterExpansionRows(rows, "test_smoke").length, 1);
    assert.equal(filterExpansionRows(rows, "remaining").length, 3);
    const summary = summarizeExpansionInventory(rows);
    assert.ok(summary.migrationCompletionPercent > 0);
    assert.equal(summary.alreadyLinked, 1);
  });

  it("plain language distinguishes existing vs new lead", () => {
    assert.equal(plainLanguageExpansionDecision("link_existing_lead"), "Link to existing lead");
    assert.equal(plainLanguageExpansionDecision("create_new_lead"), "Create new lead");
    assert.equal(
      plainLanguageExpansionDecision("quarantine_unmapped_stage"),
      "Required stage unmapped — quarantined"
    );
  });

  it("primary action is singular per stage", () => {
    assert.equal(primaryActionForBatchStatus("draft"), "Review exceptions");
    assert.equal(primaryActionForBatchStatus("approved"), "Apply approved batch");
    assert.equal(primaryActionForBatchStatus("blocked"), "Investigate stop condition");
  });

  it("profiles data quality counters", () => {
    const profile = profileExpansionDataQuality([
      {
        hubspotContactId: "1",
        displayName: "Contact 1",
        email: null,
        phone: null,
        decision: "quarantine_missing_identity",
        hubspotOwnerId: null,
        sourceStageLabel: null,
        lastSourceActivityAt: "not-a-date",
        proposedLeadId: null,
      },
      {
        hubspotContactId: "2",
        displayName: "Ada",
        email: "ada@example.com",
        phone: "0400111222",
        decision: "link_existing_lead",
        hubspotOwnerId: "o1",
        sourceStageLabel: null,
        lastSourceActivityAt: "2026-01-01T00:00:00Z",
        proposedLeadId: "l1",
      },
      {
        hubspotContactId: "3",
        displayName: "Bob",
        email: "ada@example.com",
        phone: "0400111222",
        decision: "quarantine_test_or_smoke",
        hubspotOwnerId: null,
        sourceStageLabel: null,
        lastSourceActivityAt: null,
        proposedLeadId: null,
      },
    ]);
    assert.ok(profile.missingEmails >= 1);
    assert.ok(profile.duplicateEmails >= 1);
    assert.ok(profile.possibleTestOrSmoke >= 1);
    assert.ok(profile.malformedTimestamps >= 1);
  });

  it("blocks backup watermark updates via mutation allowlist", () => {
    assert.throws(
      () => assertExpansionMutationAllowlist("fi_external_hubspot_backup_watermarks", "update"),
      /MUTATION_GUARD/
    );
    assert.throws(
      () => assertExpansionMutationAllowlist("fi_external_hubspot_backup_watermarks", "insert"),
      /MUTATION_GUARD/
    );
    assertBackupWatermarkNotAllowlisted();
  });

  it("inventory signature is deterministic for a fixed snapshot", () => {
    const rows = [
      toInventorySignatureRow(
        row({
          hubspotContactId: "2",
          decision: "create_new_lead",
          proposedLeadId: null,
          reasonCode: "no_match",
        })
      ),
      toInventorySignatureRow(
        row({
          hubspotContactId: "1",
          decision: "already_applied",
          proposedLeadId: "L1",
          reasonCode: "person_source_id_single_lead",
        })
      ),
    ];
    const a = computeInventorySignature(rows);
    const b = computeInventorySignature([...rows].reverse());
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  it("uses the staging archived state even when raw properties omit it", () => {
    assert.equal(
      isArchivedHubspotStagingContact({
        archivedColumn: true,
        rawPayload: { properties: { email: "archived@example.org" } },
      }),
      true
    );
    assert.equal(
      isArchivedHubspotStagingContact({
        archivedColumn: false,
        rawPayload: { archived: true, properties: {} },
      }),
      true
    );
  });

  it("classification delta identifies newly added and modified contacts", () => {
    const before = [
      {
        ...toInventorySignatureRow(row({ hubspotContactId: "1", decision: "already_applied" })),
      },
      {
        ...toInventorySignatureRow(
          row({
            hubspotContactId: "2",
            decision: "link_existing_lead",
            proposedLeadId: "L2",
          })
        ),
        payloadChecksum: "aaa",
      },
    ];
    const after = [
      {
        ...toInventorySignatureRow(row({ hubspotContactId: "1", decision: "already_applied" })),
      },
      {
        ...toInventorySignatureRow(
          row({
            hubspotContactId: "2",
            decision: "already_applied",
            proposedLeadId: "L2",
          })
        ),
        payloadChecksum: "bbb",
      },
      toInventorySignatureRow(
        row({ hubspotContactId: "3", decision: "create_new_lead", proposedLeadId: null })
      ),
    ];
    const delta = diffInventorySignatures(before, after);
    assert.deepEqual(delta.newlyAppearingContactIds, ["3"]);
    assert.deepEqual(delta.removedContactIds, []);
    assert.deepEqual(delta.sourceFieldChangedContactIds, ["2"]);
    assert.deepEqual(delta.decisionChangedContactIds, ["2"]);
    assert.equal(delta.unexplainedChangeCount, 3);
  });

  it("coverage reconciliation rejects unexplained records", () => {
    const rows = [
      toInventorySignatureRow(row({ hubspotContactId: "1", decision: "already_applied" })),
      toInventorySignatureRow(row({ hubspotContactId: "2", decision: "create_new_lead" })),
      toInventorySignatureRow(
        row({ hubspotContactId: "3", decision: "patient_link_review_required" })
      ),
      toInventorySignatureRow(
        row({ hubspotContactId: "4", decision: "quarantine_test_or_smoke" })
      ),
    ];
    const recon = reconcileContactCoverage(rows);
    assert.equal(recon.totalSourceContacts, 4);
    assert.equal(recon.mappedContacts, 1);
    assert.equal(recon.createCandidates, 1);
    assert.equal(recon.patientReview, 1);
    assert.equal(recon.quarantined, 1);
    assert.equal(recon.unexplained, 0);
    assertCoverageReconciled(recon);
    assert.throws(
      () =>
        reconcileContactCoverage([
          ...rows,
          toInventorySignatureRow(row({ hubspotContactId: "1", decision: "already_applied" })),
        ]),
      /duplicate source contact/
    );
  });

  it("changed source contact identity revalidation fails closed", () => {
    assertChangedContactIdentitySafe({
      sameTenant: true,
      sameSourceContactId: true,
      uniqueLeadTarget: true,
      newDuplicate: false,
      newPatientWarning: false,
      targetConflict: false,
      wrongTenant: false,
      existingMappingValid: true,
    });
    assert.throws(
      () =>
        assertChangedContactIdentitySafe({
          sameTenant: true,
          sameSourceContactId: true,
          uniqueLeadTarget: false,
          newDuplicate: true,
          newPatientWarning: false,
          targetConflict: false,
          wrongTenant: false,
          existingMappingValid: true,
        }),
      /REVALIDATE_FAIL/
    );
  });
});
