/**
 * Staff reconciliation recommendation engine (WorkforceOS Sprint 3.5).
 */

import { determineCanonicalStaffRecord } from "@/src/lib/workforce/staffCanonicalDecisionCore";
import type { StaffOperationalHistory } from "@/src/lib/workforce/staffOperationalHistoryCore";
import { computeTotalActivityCount } from "@/src/lib/workforce/staffOperationalHistoryCore";

export const RECONCILIATION_RECOMMENDATIONS = [
  "LINK_TO_IIOHR",
  "KEEP_EXISTING_RECORD",
  "MERGE_INTO_EXISTING",
  "MERGE_INTO_IIOHR_RECORD",
  "ARCHIVE_EMPTY_RECORD",
  "MANUAL_REVIEW_REQUIRED",
] as const;

export type ReconciliationRecommendationType =
  (typeof RECONCILIATION_RECOMMENDATIONS)[number];

export type StaffReconciliationRecommendation = {
  recommendation: ReconciliationRecommendationType;
  confidence: number;
  reasoning: string[];
  suggestedExternalId: string | null;
  suggestedTargetStaffMemberId: string | null;
  suggestedSourceStaffMemberId: string | null;
};

export type ReconciliationMatchContext = {
  emailExactMatch: boolean;
  nameMatch: boolean;
  matchScore: number;
  hasConflicts: boolean;
};

export type IiohrMatchCandidate = {
  externalId: string;
  externalEmail: string | null;
  externalName: string | null;
  employmentStatus?: string | null;
  roleCode?: string | null;
  linkedStaffMemberId?: string | null;
  operationalHistory?: StaffOperationalHistory | null;
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateReconciliationConfidence(input: {
  match: ReconciliationMatchContext;
  fiHistory: StaffOperationalHistory;
  iiohrLinked: boolean;
}): number {
  let confidence = 0;
  if (input.match.emailExactMatch) confidence += 40;
  if (input.match.nameMatch) confidence += 20;
  if (computeTotalActivityCount(input.fiHistory) > 0) confidence += 20;
  if (input.iiohrLinked || input.fiHistory.isIiohrLinked) confidence += 20;
  if (!input.match.hasConflicts) confidence += 10;
  return clampConfidence(confidence);
}

export function generateStaffReconciliationRecommendation(input: {
  fiRecord: StaffOperationalHistory;
  iiohrMatch: IiohrMatchCandidate | null;
  match: ReconciliationMatchContext;
}): StaffReconciliationRecommendation {
  const reasoning: string[] = [];
  const activity = computeTotalActivityCount(input.fiRecord);

  if (!input.iiohrMatch) {
    return {
      recommendation: "MANUAL_REVIEW_REQUIRED",
      confidence: clampConfidence(input.match.matchScore),
      reasoning: ["No IIOHR identity candidate found — operator review required"],
      suggestedExternalId: null,
      suggestedTargetStaffMemberId: null,
      suggestedSourceStaffMemberId: input.fiRecord.staffMemberId,
    };
  }

  const confidence = calculateReconciliationConfidence({
    match: input.match,
    fiHistory: input.fiRecord,
    iiohrLinked: Boolean(input.iiohrMatch.linkedStaffMemberId),
  });

  if (input.match.emailExactMatch) {
    reasoning.push("Email exact match with IIOHR identity");
  }
  if (input.match.nameMatch) {
    reasoning.push("Name match with IIOHR identity");
  }
  if (activity > 0) {
    reasoning.push("Existing FI record has operational history");
  }
  if (input.fiRecord.surgeryAssignmentCount > 0) {
    reasoning.push("Existing record has surgery history");
  }
  if (input.fiRecord.trainingCount > 0) {
    reasoning.push("Existing record has training history");
  }
  if (input.iiohrMatch.externalId) {
    reasoning.push("IIOHR identity exists in sync feed");
  }

  if (confidence < 50 || input.match.hasConflicts) {
    return {
      recommendation: "MANUAL_REVIEW_REQUIRED",
      confidence,
      reasoning: [
        ...reasoning,
        input.match.hasConflicts
          ? "Identity conflict detected — manual review required"
          : "Confidence below threshold for automated recommendation",
      ],
      suggestedExternalId: input.iiohrMatch.externalId,
      suggestedTargetStaffMemberId: input.fiRecord.staffMemberId,
      suggestedSourceStaffMemberId: null,
    };
  }

  if (input.fiRecord.isManuallyCreated && activity === 0) {
    return {
      recommendation: "ARCHIVE_EMPTY_RECORD",
      confidence,
      reasoning: [
        ...reasoning,
        "FI record appears manually created with no operational footprint",
      ],
      suggestedExternalId: input.iiohrMatch.externalId,
      suggestedTargetStaffMemberId: input.iiohrMatch.linkedStaffMemberId ?? null,
      suggestedSourceStaffMemberId: input.fiRecord.staffMemberId,
    };
  }

  const candidates = [input.fiRecord];
  if (input.iiohrMatch.operationalHistory) {
    candidates.push({
      ...input.iiohrMatch.operationalHistory,
      label: input.iiohrMatch.externalName ?? "IIOHR record",
    } as StaffOperationalHistory & { label?: string });
  }

  const canonical = determineCanonicalStaffRecord(
    candidates.map((c) => ({ ...c, label: (c as { label?: string }).label }))
  );

  if (
    canonical &&
    input.iiohrMatch.linkedStaffMemberId &&
    canonical.canonicalStaffId === input.iiohrMatch.linkedStaffMemberId
  ) {
    return {
      recommendation: "MERGE_INTO_IIOHR_RECORD",
      confidence,
      reasoning: [...reasoning, ...canonical.reasoning, "IIOHR-linked record scores higher"],
      suggestedExternalId: input.iiohrMatch.externalId,
      suggestedTargetStaffMemberId: input.iiohrMatch.linkedStaffMemberId,
      suggestedSourceStaffMemberId: input.fiRecord.staffMemberId,
    };
  }

  if (activity > 0 && input.match.emailExactMatch) {
    return {
      recommendation: "LINK_TO_IIOHR",
      confidence,
      reasoning: [...reasoning, "Keep FI operational record and link IIOHR identity"],
      suggestedExternalId: input.iiohrMatch.externalId,
      suggestedTargetStaffMemberId: input.fiRecord.staffMemberId,
      suggestedSourceStaffMemberId: null,
    };
  }

  if (canonical && canonical.canonicalStaffId === input.fiRecord.staffMemberId) {
    return {
      recommendation: "KEEP_EXISTING_RECORD",
      confidence,
      reasoning: [...reasoning, ...canonical.reasoning],
      suggestedExternalId: input.iiohrMatch.externalId,
      suggestedTargetStaffMemberId: input.fiRecord.staffMemberId,
      suggestedSourceStaffMemberId: null,
    };
  }

  return {
    recommendation: "MERGE_INTO_EXISTING",
    confidence,
    reasoning: [...reasoning, ...(canonical?.reasoning ?? []), "Merge weaker record into canonical survivor"],
    suggestedExternalId: input.iiohrMatch.externalId,
    suggestedTargetStaffMemberId: canonical?.canonicalStaffId ?? input.fiRecord.staffMemberId,
    suggestedSourceStaffMemberId:
      canonical?.canonicalStaffId === input.fiRecord.staffMemberId
        ? input.iiohrMatch.linkedStaffMemberId ?? null
        : input.fiRecord.staffMemberId,
  };
}