import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertBatchSizeLimits,
  canAutoApplyCandidate,
  computeOwnerResolutionChecksum,
  deriveResolutionState,
  filterOwnerRows,
  rankStaffCandidates,
  summarizeOwnerWorkspace,
} from "./hubspotOwnerResolutionCore";
import { assertMutationAllowlist } from "./hubspotOwnerMappingCore";
import type { HubspotOwnerWorkspaceRow } from "./hubspotOwnerResolutionTypes";

function row(partial: Partial<HubspotOwnerWorkspaceRow>): HubspotOwnerWorkspaceRow {
  return {
    hubspotOwnerId: "1",
    displayName: "Owner",
    email: null,
    archived: false,
    resolutionState: "unresolved",
    decisionId: null,
    targetStaffId: null,
    targetStaffName: null,
    operatorNote: null,
    ownedContacts: 0,
    ownedDeals: 0,
    ownedTasks: 0,
    ownedActivities: 0,
    lastOwnedActivityAt: null,
    inMigrationCohort: false,
    candidates: [],
    conflictReason: null,
    sortPriority: 5,
    ...partial,
  };
}

describe("hubspotOwnerResolution 1C", () => {
  it("name-only suggestion cannot auto-apply", () => {
    const ranked = rankStaffCandidates({
      ownerEmail: null,
      ownerDisplayName: "Jane Doe",
      staff: [
        {
          staffId: "s1",
          fullName: "Jane Doe",
          role: "consultant",
          isActive: true,
          email: "jane@clinic.org",
          alreadyHasHubspotOwner: false,
          existingHubspotOwnerId: null,
        },
      ],
    });
    assert.equal(ranked.length, 1);
    assert.equal(canAutoApplyCandidate(ranked[0]), false);
  });

  it("exact email can be deterministic", () => {
    const ranked = rankStaffCandidates({
      ownerEmail: "jane@clinic.org",
      ownerDisplayName: "Jane",
      staff: [
        {
          staffId: "s1",
          fullName: "Jane Doe",
          role: "consultant",
          isActive: true,
          email: "jane@clinic.org",
          alreadyHasHubspotOwner: false,
          existingHubspotOwnerId: null,
        },
      ],
    });
    assert.equal(canAutoApplyCandidate(ranked[0]), true);
  });

  it("inactive staff is not deterministic auto-apply", () => {
    const ranked = rankStaffCandidates({
      ownerEmail: "jane@clinic.org",
      ownerDisplayName: null,
      staff: [
        {
          staffId: "s1",
          fullName: "Jane",
          role: "consultant",
          isActive: false,
          email: "jane@clinic.org",
          alreadyHasHubspotOwner: false,
          existingHubspotOwnerId: null,
        },
      ],
    });
    assert.equal(canAutoApplyCandidate(ranked[0]), false);
  });

  it("batch size enforcement", () => {
    assert.throws(() => assertBatchSizeLimits(11, 0));
    assert.throws(() => assertBatchSizeLimits(1, 25));
    assert.doesNotThrow(() => assertBatchSizeLimits(10, 0));
  });

  it("checksum changes when proposal changes", () => {
    const a = computeOwnerResolutionChecksum([
      { hubspotOwnerId: "1", targetStaffId: "s1", resolutionState: "proposed" },
    ]);
    const b = computeOwnerResolutionChecksum([
      { hubspotOwnerId: "1", targetStaffId: "s2", resolutionState: "proposed" },
    ]);
    assert.notEqual(a, b);
  });

  it("filters needs attention", () => {
    const rows = [
      row({ resolutionState: "unresolved" }),
      row({ hubspotOwnerId: "2", resolutionState: "mapped" }),
      row({ hubspotOwnerId: "3", resolutionState: "conflict" }),
    ];
    const filtered = filterOwnerRows(rows, "needs_attention");
    assert.equal(filtered.length, 2);
  });

  it("summary distinguishes relevant coverage", () => {
    const summary = summarizeOwnerWorkspace([
      row({ resolutionState: "already_applied", archived: false, inMigrationCohort: true }),
      row({
        hubspotOwnerId: "2",
        resolutionState: "archived_source_owner",
        archived: true,
        inMigrationCohort: false,
        ownedContacts: 0,
        ownedDeals: 0,
      }),
    ]);
    assert.equal(summary.mapped, 1);
    assert.equal(summary.archivedOrHistorical, 1);
    assert.equal(summary.relevantActiveDenominator, 1);
    assert.equal(summary.relevantActiveMapped, 1);
  });

  it("stale preview guard is checksum-based", () => {
    const checksum = computeOwnerResolutionChecksum([
      { hubspotOwnerId: "120", targetStaffId: "staff", resolutionState: "proposed" },
    ]);
    assert.equal(checksum.length, 64);
  });

  it("does not silently mark deterministic candidates as proposed", () => {
    const ranked = rankStaffCandidates({
      ownerEmail: "jane@clinic.org",
      ownerDisplayName: "Jane",
      staff: [
        {
          staffId: "s1",
          fullName: "Jane",
          role: "consultant",
          isActive: true,
          email: "jane@clinic.org",
          alreadyHasHubspotOwner: false,
          existingHubspotOwnerId: null,
        },
      ],
    });
    const state = deriveResolutionState({
      hasAppliedMapping: false,
      savedState: null,
      archived: false,
      candidates: ranked,
      conflictReason: null,
    });
    assert.equal(state, "unresolved");
    assert.equal(canAutoApplyCandidate(ranked[0]), true);
  });

  it("historical-only and archived-source remain distinct states", () => {
    assert.equal(
      deriveResolutionState({
        hasAppliedMapping: false,
        savedState: "historical_only",
        archived: true,
        candidates: [],
        conflictReason: null,
      }),
      "historical_only"
    );
    assert.equal(
      deriveResolutionState({
        hasAppliedMapping: false,
        savedState: null,
        archived: true,
        candidates: [],
        conflictReason: null,
      }),
      "archived_source_owner"
    );
  });

  it("non-allowlisted mutation attempt fails closed", () => {
    assert.throws(() => assertMutationAllowlist("fi_staff", "update"));
    assert.throws(() => assertMutationAllowlist("fi_users", "insert"));
    assert.throws(() => assertMutationAllowlist("fi_leads", "insert"));
  });

  it("suggested_match filter includes high-confidence candidates", () => {
    const ranked = rankStaffCandidates({
      ownerEmail: "a@clinic.org",
      ownerDisplayName: null,
      staff: [
        {
          staffId: "s1",
          fullName: "A",
          role: "admin",
          isActive: true,
          email: "a@clinic.org",
          alreadyHasHubspotOwner: false,
          existingHubspotOwnerId: null,
        },
      ],
    });
    const rows = [row({ candidates: ranked, resolutionState: "unresolved" })];
    assert.equal(filterOwnerRows(rows, "suggested_match").length, 1);
  });
});
