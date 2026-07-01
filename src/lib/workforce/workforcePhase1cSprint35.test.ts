import assert from "node:assert/strict";
import { test } from "node:test";

import { determineCanonicalStaffRecord } from "@/src/lib/workforce/staffCanonicalDecisionCore";
import { generateDuplicateMergeRecommendation } from "@/src/lib/workforce/duplicateMergeRecommendationCore";
import {
  calculateReconciliationConfidence,
  generateStaffReconciliationRecommendation,
} from "@/src/lib/workforce/staffReconciliationRecommendationCore";
import type { StaffOperationalHistory } from "@/src/lib/workforce/staffOperationalHistoryCore";

function history(
  id: string,
  overrides: Partial<StaffOperationalHistory> = {}
): StaffOperationalHistory {
  return {
    staffMemberId: id,
    fiStaffId: null,
    fullName: `Staff ${id}`,
    email: null,
    roleCode: "nurse",
    employmentStatus: "active",
    createdAt: "2025-01-01T00:00:00.000Z",
    sourceSystem: "manual",
    isIiohrLinked: false,
    isManuallyCreated: true,
    isInactive: false,
    trainingCount: 0,
    sopAcknowledgementCount: 0,
    surgeryAssignmentCount: 0,
    calendarAssignmentCount: 0,
    patientAssignmentCount: 0,
    complianceHistoryCount: 0,
    academyCompetencyCount: 0,
    credentialCount: 0,
    verifiedCredentialCount: 0,
    certificationCount: 0,
    identityLinkCount: 0,
    daysSinceCreated: 30,
    totalActivityCount: 0,
    ...overrides,
  };
}

test("record with more surgery history wins canonical selection", () => {
  const result = determineCanonicalStaffRecord([
    history("a", { fullName: "Paul Green", surgeryAssignmentCount: 14, trainingCount: 7, daysSinceCreated: 200, isManuallyCreated: false }),
    history("b", { fullName: "Paul Green B", surgeryAssignmentCount: 0, trainingCount: 0, daysSinceCreated: 5 }),
  ]);
  assert.ok(result);
  assert.equal(result?.canonicalStaffId, "a");
  assert.ok(result?.reasoning.some((r) => r.includes("Surgery assignments")));
});

test("IIOHR linked record scores higher", () => {
  const linked = history("linked", { isIiohrLinked: true, identityLinkCount: 1, isManuallyCreated: false });
  const manual = history("manual", { isManuallyCreated: true });
  const linkedScore = determineCanonicalStaffRecord([
    { ...linked, label: "Linked" },
    { ...manual, label: "Manual" },
  ]);
  assert.equal(linkedScore?.canonicalStaffId, "linked");
});

test("email match increases reconciliation confidence", () => {
  const confidence = calculateReconciliationConfidence({
    match: { emailExactMatch: true, nameMatch: false, matchScore: 90, hasConflicts: false },
    fiHistory: history("fi1", { surgeryAssignmentCount: 2 }),
    iiohrLinked: false,
  });
  assert.ok(confidence >= 60);
});

test("operational history increases reconciliation confidence", () => {
  const withHistory = calculateReconciliationConfidence({
    match: { emailExactMatch: false, nameMatch: true, matchScore: 70, hasConflicts: false },
    fiHistory: history("fi1", { trainingCount: 5, surgeryAssignmentCount: 3 }),
    iiohrLinked: false,
  });
  const empty = calculateReconciliationConfidence({
    match: { emailExactMatch: false, nameMatch: true, matchScore: 70, hasConflicts: false },
    fiHistory: history("fi2"),
    iiohrLinked: false,
  });
  assert.ok(withHistory > empty);
});

test("empty manually created record recommends archive", () => {
  const result = generateStaffReconciliationRecommendation({
    fiRecord: history("empty", { isManuallyCreated: true }),
    iiohrMatch: {
      externalId: "ext-1",
      externalEmail: "support@clinic.test",
      externalName: "Paul Green",
    },
    match: { emailExactMatch: true, nameMatch: true, matchScore: 95, hasConflicts: false },
  });
  assert.equal(result.recommendation, "ARCHIVE_EMPTY_RECORD");
});

test("low confidence routes to manual review", () => {
  const result = generateStaffReconciliationRecommendation({
    fiRecord: history("fi"),
    iiohrMatch: {
      externalId: "ext-2",
      externalEmail: "other@test.com",
      externalName: "Different Person",
    },
    match: { emailExactMatch: false, nameMatch: false, matchScore: 20, hasConflicts: true },
  });
  assert.equal(result.recommendation, "MANUAL_REVIEW_REQUIRED");
  assert.ok(result.confidence < 50);
});

test("duplicate merge recommendation keeps stronger record", () => {
  const result = generateDuplicateMergeRecommendation({
    recordA: history("a", {
      fullName: "Paul Green",
      email: "support@clinic.test",
      trainingCount: 7,
      surgeryAssignmentCount: 14,
      daysSinceCreated: 200,
    }),
    recordB: history("b", {
      fullName: "Paul Green",
      email: "manager@clinic.test",
      trainingCount: 0,
      surgeryAssignmentCount: 0,
      daysSinceCreated: 5,
    }),
    matchEmail: true,
    matchName: true,
    similarityScore: 92,
  });
  assert.equal(result.keepStaffId, "a");
  assert.equal(result.archiveStaffId, "b");
  assert.ok(result.confidence >= 50);
  assert.ok(result.reasoning.length > 0);
});