/**
 * Canonical staff record scoring (WorkforceOS Sprint 3.5).
 */

import type { StaffOperationalHistory } from "@/src/lib/workforce/staffOperationalHistoryCore";
import { computeTotalActivityCount } from "@/src/lib/workforce/staffOperationalHistoryCore";

export type CanonicalStaffDecision = {
  canonicalStaffId: string;
  score: number;
  reasoning: string[];
};

export type CanonicalStaffCandidate = StaffOperationalHistory & {
  label?: string;
};

const SCORE = {
  IIOHR_LINKED: 30,
  TRAINING: 20,
  SOP: 15,
  SURGERY: 35,
  CALENDAR: 20,
  COMPLIANCE: 20,
  ACADEMY: 15,
  PATIENT: 20,
  VERIFIED_CREDENTIALS: 20,
  MANUAL_EMPTY: -40,
  INACTIVE: -30,
} as const;

export function scoreStaffOperationalHistory(
  history: StaffOperationalHistory
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 0;

  if (history.isIiohrLinked) {
    score += SCORE.IIOHR_LINKED;
    reasoning.push("Linked to IIOHR HR identity");
  }
  if (history.trainingCount > 0) {
    score += SCORE.TRAINING;
    reasoning.push(`Training history (${history.trainingCount} record(s))`);
  }
  if (history.sopAcknowledgementCount > 0) {
    score += SCORE.SOP;
    reasoning.push(`SOP acknowledgements (${history.sopAcknowledgementCount})`);
  }
  if (history.surgeryAssignmentCount > 0) {
    score += SCORE.SURGERY;
    reasoning.push(`Surgery assignments (${history.surgeryAssignmentCount})`);
  }
  if (history.calendarAssignmentCount > 0) {
    score += SCORE.CALENDAR;
    reasoning.push(`Calendar assignments (${history.calendarAssignmentCount})`);
  }
  if (history.complianceHistoryCount > 0) {
    score += SCORE.COMPLIANCE;
    reasoning.push(`Compliance history (${history.complianceHistoryCount})`);
  }
  if (history.academyCompetencyCount > 0) {
    score += SCORE.ACADEMY;
    reasoning.push(`Academy competency history (${history.academyCompetencyCount})`);
  }
  if (history.patientAssignmentCount > 0) {
    score += SCORE.PATIENT;
    reasoning.push(`Patient assignments (${history.patientAssignmentCount})`);
  }
  if (history.verifiedCredentialCount > 0) {
    score += SCORE.VERIFIED_CREDENTIALS;
    reasoning.push(`Verified credentials (${history.verifiedCredentialCount})`);
  }

  const activity = computeTotalActivityCount(history);
  if (history.isManuallyCreated && activity === 0) {
    score += SCORE.MANUAL_EMPTY;
    reasoning.push("Manually created record with no operational history");
  }
  if (history.isInactive || activity === 0) {
    score += SCORE.INACTIVE;
    reasoning.push("Inactive or no recorded activity");
  }

  return { score, reasoning };
}

export function determineCanonicalStaffRecord(
  candidates: CanonicalStaffCandidate[]
): CanonicalStaffDecision | null {
  if (!candidates.length) return null;

  let best: CanonicalStaffDecision | null = null;

  for (const candidate of candidates) {
    const { score, reasoning } = scoreStaffOperationalHistory(candidate);
    const label = candidate.label ?? candidate.fullName;
    const entry: CanonicalStaffDecision = {
      canonicalStaffId: candidate.staffMemberId,
      score,
      reasoning: reasoning.map((r) => `${label}: ${r}`),
    };
    if (!best || entry.score > best.score) {
      best = entry;
    }
  }

  return best;
}