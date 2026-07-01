import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateStaffIdentityMatchScore,
  findExistingStaffMatch,
  normalizeEmail,
  normalizeName,
  reconcileInboundStaffIdentity,
  type IdentityLinkSnapshot,
  type StaffMemberSnapshot,
} from "@/src/lib/workforce/identityReconciliationCore";
import {
  detectDuplicateCandidatesForMembers,
  sortStaffPairId,
} from "@/src/lib/workforce/staffDuplicateDetectionCore";
import { buildHrSyncRunCompletionPatch } from "@/src/lib/workforce/hrSyncAuditCore";

const TENANT = "00000000-0000-4000-8000-000000000001";

function member(
  id: string,
  opts?: Partial<StaffMemberSnapshot>
): StaffMemberSnapshot {
  return {
    id,
    tenantId: TENANT,
    fullName: opts?.fullName ?? "Ana Example",
    email: opts?.email ?? "ana@example.com",
    phone: opts?.phone ?? null,
    roleCode: opts?.roleCode ?? "consultant",
    fiStaffId: opts?.fiStaffId ?? null,
    sourceExternalId: opts?.sourceExternalId ?? null,
    mergedInto: opts?.mergedInto ?? null,
    archivedAt: opts?.archivedAt ?? null,
  };
}

test("normalizeEmail lowercases and trims", () => {
  assert.equal(normalizeEmail("  Ana@Example.COM "), "ana@example.com");
  assert.equal(normalizeEmail(""), null);
});

test("normalizeName collapses punctuation and whitespace", () => {
  assert.equal(normalizeName("  Dr. Ana O'Neill "), "dr ana oneill");
});

test("calculateStaffIdentityMatchScore prioritises email", () => {
  const score = calculateStaffIdentityMatchScore(member("s1"), {
    sourceSystem: "iiohr_hr",
    externalId: "ext-1",
    email: "ana@example.com",
    fullName: "Different Name",
  });
  assert.equal(score, 100);
});

test("existing external_id link wins via identity links", () => {
  const links: IdentityLinkSnapshot[] = [
    {
      staffMemberId: "m-1",
      sourceSystem: "iiohr_hr",
      externalId: "ext-99",
      externalEmail: null,
      externalName: null,
    },
  ];
  const result = findExistingStaffMatch({
    tenantId: TENANT,
    sourceSystem: "iiohr_hr",
    externalId: "ext-99",
    email: "other@example.com",
    fullName: "Other Person",
    staffMembers: [member("m-1", { email: "ana@example.com" })],
    identityLinks: links,
  });
  assert.equal(result.staffMemberId, "m-1");
  assert.equal(result.matchMethod, "existing_identity_link");
});

test("exact email reconciliation attaches to existing staff", () => {
  const result = reconcileInboundStaffIdentity({
    tenantId: TENANT,
    inbound: {
      sourceSystem: "iiohr_hr",
      externalId: "ext-new",
      email: "ana@example.com",
      fullName: "Ana Example",
    },
    staffMembers: [member("m-1")],
    identityLinks: [],
  });
  assert.equal(result.staffMemberId, "m-1");
  assert.equal(result.shouldUpdate, true);
  assert.equal(result.shouldCreate, false);
});

test("name-only conflict with different email requires manual review", () => {
  const result = reconcileInboundStaffIdentity({
    tenantId: TENANT,
    inbound: {
      sourceSystem: "iiohr_hr",
      externalId: "ext-new",
      email: "new@example.com",
      fullName: "Ana Example",
    },
    staffMembers: [member("m-1", { email: "ana@example.com" })],
    identityLinks: [],
  });
  assert.equal(result.requiresManualReview, true);
  assert.equal(result.shouldCreate, false);
});

test("duplicate pair sorting is idempotent", () => {
  const [a, b] = sortStaffPairId(
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  );
  assert.equal(a, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(b, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
});

test("duplicate detection does not duplicate same pair", () => {
  const members = [
    member("a", { email: "same@example.com", fullName: "Person A" }),
    member("b", { email: "same@example.com", fullName: "Person B" }),
  ];
  const first = detectDuplicateCandidatesForMembers(members);
  const second = detectDuplicateCandidatesForMembers(members);
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(first[0]?.staffAId, second[0]?.staffAId);
});

test("HR sync run completion patch summary", () => {
  const patch = buildHrSyncRunCompletionPatch({
    counts: {
      recordsReceived: 13,
      recordsCreated: 0,
      recordsUpdated: 3,
      recordsLinked: 10,
      duplicatesDetected: 2,
      recordsSkipped: 0,
    },
    warnings: ["name conflict"],
    errors: [],
    status: "success",
    completedAt: "2026-07-01T12:00:00.000Z",
  });
  assert.equal(patch.records_linked, 10);
  assert.equal(patch.records_received, 13);
  assert.equal(patch.duplicates_detected, 2);
  assert.deepEqual(patch.warnings, ["name conflict"]);
});