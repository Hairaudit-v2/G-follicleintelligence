/**
 * Duplicate merge recommendation engine (WorkforceOS Sprint 3.5).
 */

import {
  determineCanonicalStaffRecord,
  scoreStaffOperationalHistory,
} from "@/src/lib/workforce/staffCanonicalDecisionCore";
import type { StaffOperationalHistory } from "@/src/lib/workforce/staffOperationalHistoryCore";

export type DuplicateMergeRecommendation = {
  keepStaffId: string;
  archiveStaffId: string;
  confidence: number;
  reasoning: string[];
};

export function generateDuplicateMergeRecommendation(input: {
  recordA: StaffOperationalHistory;
  recordB: StaffOperationalHistory;
  matchEmail: boolean;
  matchName: boolean;
  similarityScore: number;
}): DuplicateMergeRecommendation {
  const scoreA = scoreStaffOperationalHistory(input.recordA);
  const scoreB = scoreStaffOperationalHistory(input.recordB);
  const canonical = determineCanonicalStaffRecord([
    { ...input.recordA, label: input.recordA.fullName },
    { ...input.recordB, label: input.recordB.fullName },
  ]);

  const keepStaffId =
    canonical?.canonicalStaffId ??
    (scoreA.score >= scoreB.score ? input.recordA.staffMemberId : input.recordB.staffMemberId);
  const archiveStaffId =
    keepStaffId === input.recordA.staffMemberId
      ? input.recordB.staffMemberId
      : input.recordA.staffMemberId;

  const reasoning: string[] = [];
  if (input.recordA.surgeryAssignmentCount > input.recordB.surgeryAssignmentCount) {
    reasoning.push(`${input.recordA.fullName} has more surgery history`);
  } else if (input.recordB.surgeryAssignmentCount > input.recordA.surgeryAssignmentCount) {
    reasoning.push(`${input.recordB.fullName} has more surgery history`);
  }
  if (input.recordA.trainingCount > input.recordB.trainingCount) {
    reasoning.push(`${input.recordA.fullName} has more training history`);
  } else if (input.recordB.trainingCount > input.recordA.trainingCount) {
    reasoning.push(`${input.recordB.fullName} has more training history`);
  }
  if (input.recordA.isIiohrLinked && !input.recordB.isIiohrLinked) {
    reasoning.push(`${input.recordA.fullName} is linked to IIOHR`);
  } else if (input.recordB.isIiohrLinked && !input.recordA.isIiohrLinked) {
    reasoning.push(`${input.recordB.fullName} is linked to IIOHR`);
  }
  if (input.recordA.daysSinceCreated > input.recordB.daysSinceCreated) {
    reasoning.push(`${input.recordA.fullName} is the longer-tenured record`);
  } else if (input.recordB.daysSinceCreated > input.recordA.daysSinceCreated) {
    reasoning.push(`${input.recordB.fullName} is the longer-tenured record`);
  }

  reasoning.push(...(canonical?.reasoning ?? []));

  let confidence = Math.min(100, Math.max(scoreA.score, scoreB.score));
  if (input.matchEmail) confidence += 15;
  if (input.matchName) confidence += 10;
  confidence = Math.min(100, Math.round((confidence + input.similarityScore) / 2));

  if (confidence < 50) {
    reasoning.push("Low confidence — review before approving merge");
  }

  return {
    keepStaffId,
    archiveStaffId,
    confidence,
    reasoning,
  };
}