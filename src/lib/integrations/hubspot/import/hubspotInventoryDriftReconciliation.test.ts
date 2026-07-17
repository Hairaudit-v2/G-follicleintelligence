import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HubspotContactLeadInventorySignatureRow } from "./hubspotContactLeadExpansionCore";
import {
  HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION,
  HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2,
  assertComparableHubspotInventorySnapshots,
  assertExplicitInventoryFreezeApproval,
  assertInventoryReconciliationCanClose,
  assertMutuallyExclusivePrimaryCohorts,
  canonicalizeHubspotInventoryV2,
  compareHubspotInventorySnapshots,
  computeHubspotInventoryChecksumV1,
  computeHubspotInventoryChecksumV2,
  countAppliedOneECreationBatches,
  createHubspotInventorySnapshot,
} from "./hubspotInventoryDriftReconciliation";

const META = {
  generatedAt: "2026-07-17T00:00:00.000Z",
  sourceCutoff: "2026-07-16T16:00:34.530Z",
  tenantId: "tenant-1",
  integrationId: "integration-1",
  codeCommit: "commit-1",
};

function row(
  hubspotContactId: string,
  partial: Partial<HubspotContactLeadInventorySignatureRow> = {}
): HubspotContactLeadInventorySignatureRow {
  return {
    hubspotContactId,
    decision: "already_applied",
    reasonCode: "existing_external_lead_or_source_id",
    proposedLeadId: "lead-1",
    patientProtectionWarning: null,
    quarantineReason: null,
    identityTier: "tier1_external_identity",
    payloadChecksum: "payload-1",
    lastSourceActivityAt: "2026-07-16T00:00:00Z",
    ...partial,
  };
}

describe("FI-HUBSPOT-IMPORT-1E-D checksum contracts", () => {
  it("keeps v1 deterministic across row and object-key ordering", () => {
    const first = row("1");
    const reordered = {
      lastSourceActivityAt: first.lastSourceActivityAt,
      payloadChecksum: first.payloadChecksum,
      identityTier: first.identityTier,
      quarantineReason: first.quarantineReason,
      patientProtectionWarning: first.patientProtectionWarning,
      proposedLeadId: first.proposedLeadId,
      reasonCode: first.reasonCode,
      decision: first.decision,
      hubspotContactId: first.hubspotContactId,
    } as HubspotContactLeadInventorySignatureRow;
    const a = computeHubspotInventoryChecksumV1([row("2"), first]);
    const b = computeHubspotInventoryChecksumV1([reordered, row("2")]);
    assert.equal(a, b);
  });

  it("treats equivalent null and blank v1 values deterministically", () => {
    assert.equal(
      computeHubspotInventoryChecksumV1([row("1", { proposedLeadId: null })]),
      computeHubspotInventoryChecksumV1([row("1", { proposedLeadId: "" })])
    );
  });

  it("canonicalizes equivalent timestamps in v2", () => {
    const a = canonicalizeHubspotInventoryV2({
      ...META,
      rows: [row("1", { lastSourceActivityAt: "2026-07-16T10:00:00+10:00" })],
    });
    const b = canonicalizeHubspotInventoryV2({
      ...META,
      rows: [row("1", { lastSourceActivityAt: "2026-07-16T00:00:00.000Z" })],
    });
    assert.equal(a, b);
  });

  it("records and rejects checksum contract version mismatches", () => {
    const expected = createHubspotInventorySnapshot({
      ...META,
      rows: [row("1")],
      contractVersion: HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION,
    });
    const current = createHubspotInventorySnapshot({
      ...META,
      rows: [row("1")],
      contractVersion: HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2,
    });
    assert.throws(
      () => assertComparableHubspotInventorySnapshots(expected, current),
      /contract version mismatch/
    );
  });

  it("does not silently compare inventories from different code versions", () => {
    const expected = createHubspotInventorySnapshot({
      ...META,
      rows: [row("1")],
    });
    const current = createHubspotInventorySnapshot({
      ...META,
      codeCommit: "commit-2",
      rows: [row("1")],
    });
    assert.throws(
      () => assertComparableHubspotInventorySnapshots(expected, current),
      /code version mismatch/
    );
  });

  it("keeps v2 deterministic under pagination-like row reordering and stable field order", () => {
    const rows = [
      row("2", { lastSourceActivityAt: "2026-07-16T00:00:00.000Z" }),
      row("1", {
        reasonCode: "person_source_id_single_lead",
        lastSourceActivityAt: "2026-07-16T10:00:00+10:00",
      }),
    ];
    const a = computeHubspotInventoryChecksumV2({
      ...META,
      rows,
    });
    const b = computeHubspotInventoryChecksumV2({
      ...META,
      rows: [...rows].reverse(),
    });
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  it("requires explicit freeze approval before adopting a replacement checksum", () => {
    assert.doesNotThrow(() =>
      assertExplicitInventoryFreezeApproval({
        approved: true,
        reconciledUnexplainedCount: 0,
        expectedReplacementChecksum:
          "1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b",
        proposedReplacementChecksum:
          "1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b",
      })
    );
  });
});

describe("FI-HUBSPOT-IMPORT-1E-D record deltas", () => {
  it("reports added, removed, source, classification, target and patient changes", () => {
    const expected = createHubspotInventorySnapshot({
      ...META,
      rows: [
        row("removed"),
        row("changed", {
          decision: "create_new_lead",
          reasonCode: "no_match",
          proposedLeadId: null,
          patientProtectionWarning: null,
          payloadChecksum: "old",
        }),
      ],
    });
    const current = createHubspotInventorySnapshot({
      ...META,
      rows: [
        row("added"),
        row("changed", {
          decision: "patient_link_review_required",
          reasonCode: "possible_patient_overlap",
          proposedLeadId: "lead-2",
          patientProtectionWarning: "review",
          payloadChecksum: "new",
        }),
      ],
    });
    const delta = compareHubspotInventorySnapshots(expected, current);
    assert.deepEqual(delta.addedContactIds, ["added"]);
    assert.deepEqual(delta.removedContactIds, ["removed"]);
    assert.equal(delta.changedRecords.length, 1);
    assert.equal(delta.classificationChangeCount, 1);
    assert.equal(delta.mappingTargetChangeCount, 1);
    assert.equal(delta.patientReviewChangeCount, 1);
    assert.equal(delta.sourceFieldChangeCount, 1);
  });

  it("does not report ordering-only changes", () => {
    const expected = createHubspotInventorySnapshot({
      ...META,
      rows: [row("2"), row("1")],
    });
    const current = createHubspotInventorySnapshot({
      ...META,
      rows: [row("1"), row("2")],
    });
    const delta = compareHubspotInventorySnapshots(expected, current);
    assert.equal(delta.changedRecords.length, 0);
    assert.equal(delta.checksumOnlyOrderingOrSerializationDifferences, 0);
  });

  it("blocks overlapping primary states and unsafe reconciliation", () => {
    assert.throws(
      () =>
        assertMutuallyExclusivePrimaryCohorts({
          mapped: ["1"],
          deferred: ["1"],
        }),
      /overlaps/
    );
    assert.throws(
      () =>
        assertInventoryReconciliationCanClose({
          unexplainedCount: 1,
          wrongTenantCount: 0,
          duplicateSourceIdCount: 0,
        }),
      /unexplained/
    );
    assert.throws(
      () =>
        assertInventoryReconciliationCanClose({
          unexplainedCount: 0,
          wrongTenantCount: 1,
          duplicateSourceIdCount: 0,
        }),
      /wrong-tenant/
    );
  });
});

describe("FI-HUBSPOT-IMPORT-1E-D safety and batch accounting", () => {
  it("does not count a zero-row rolled-back artifact as an applied creation batch", () => {
    assert.deepEqual(
      countAppliedOneECreationBatches([
        { status: "rolled_back", rowCount: 0, importedRowCount: 0 },
        { status: "import_completed", rowCount: 10, importedRowCount: 10 },
      ]),
      { completedNonEmpty: 1, zeroRowRolledBack: 1, createdRows: 10 }
    );
  });

  it("cannot freeze by replacing a checksum without explicit approval", () => {
    assert.throws(
      () =>
        assertExplicitInventoryFreezeApproval({
          approved: false,
          reconciledUnexplainedCount: 0,
          expectedReplacementChecksum: "new",
          proposedReplacementChecksum: "new",
        }),
      /explicit approval/
    );
    assert.throws(
      () =>
        assertExplicitInventoryFreezeApproval({
          approved: true,
          reconciledUnexplainedCount: 1,
          expectedReplacementChecksum: "new",
          proposedReplacementChecksum: "new",
        }),
      /unexplained/
    );
  });
});
