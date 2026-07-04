/**
 * FI-OUTCOME-INTELLIGENCE-SURGERY-BACKFILL-1 — pure backfill planning and summary logic.
 */

import type {
  PublishSurgeryCaseIntelligenceFactsResult,
  SurgeryCaseIntelligencePublishDecision,
} from "./surgeryCaseFactsPublisherCore";

export type SurgeryIntelligenceBackfillScope = {
  surgeryId?: string | null;
  caseId?: string | null;
  procedureDateFrom?: string | null;
  procedureDateTo?: string | null;
};

export type SurgeryIntelligenceBackfillInput = SurgeryIntelligenceBackfillScope & {
  dryRun: boolean;
  force?: boolean;
};

export type SurgeryIntelligenceBackfillSurgeryRow = {
  id: string;
  tenant_id: string;
  case_id: string | null;
  scheduled_date: string;
};

export type SurgeryIntelligenceBackfillItemOutcome =
  | {
      kind: "published";
      surgeryId: string;
      caseId: string | null;
      action: "inserted";
      dryRun: boolean;
    }
  | {
      kind: "updated";
      surgeryId: string;
      caseId: string | null;
      dryRun: boolean;
    }
  | {
      kind: "skipped_missing_context";
      surgeryId: string;
      caseId: string | null;
    }
  | {
      kind: "skipped_no_final_count";
      surgeryId: string;
      caseId: string | null;
    }
  | {
      kind: "skipped_newer_version";
      surgeryId: string;
      caseId: string | null;
      reason: string;
    }
  | {
      kind: "failed";
      surgeryId: string;
      caseId: string | null;
      reason: string;
    };

export type SurgeryIntelligenceBackfillSummary = {
  dryRun: boolean;
  scanned: number;
  eligible: number;
  published: number;
  updated: number;
  skippedNoFinalCount: number;
  skippedMissingContext: number;
  skippedNewerVersion: number;
  failed: number;
  failures: Array<{ surgeryId: string; reason: string }>;
};

export function resolveSurgeryIntelligenceBackfillDateRange(input: {
  procedureDateFrom?: string | null;
  procedureDateTo?: string | null;
}): { from: string; to: string } | { error: string } {
  const from = input.procedureDateFrom?.trim() || null;
  const to = input.procedureDateTo?.trim() || null;
  if (!from && !to) return { error: "Procedure date range requires from and to dates." };
  if (!from || !to) return { error: "Both procedure from and to dates are required." };
  if (from > to) return { error: "Procedure from date must be on or before to date." };
  return { from, to };
}

export function filterSurgeriesForBackfillScope(
  rows: readonly SurgeryIntelligenceBackfillSurgeryRow[],
  scope: SurgeryIntelligenceBackfillScope
): SurgeryIntelligenceBackfillSurgeryRow[] {
  let out = [...rows];
  if (scope.surgeryId?.trim()) {
    const sid = scope.surgeryId.trim();
    out = out.filter((row) => row.id === sid);
  }
  if (scope.caseId?.trim()) {
    const cid = scope.caseId.trim();
    out = out.filter((row) => row.case_id === cid);
  }
  const range = resolveSurgeryIntelligenceBackfillDateRange({
    procedureDateFrom: scope.procedureDateFrom,
    procedureDateTo: scope.procedureDateTo,
  });
  if ("from" in range) {
    out = out.filter((row) => row.scheduled_date >= range.from && row.scheduled_date <= range.to);
  }
  return out;
}

export function classifyDryRunPublishDecision(input: {
  surgeryId: string;
  caseId: string | null;
  decision: SurgeryCaseIntelligencePublishDecision;
}): SurgeryIntelligenceBackfillItemOutcome {
  if (input.decision.action === "skip") {
    return {
      kind: "skipped_newer_version",
      surgeryId: input.surgeryId,
      caseId: input.caseId,
      reason: input.decision.reason ?? "Publish skipped.",
    };
  }
  if (input.decision.action === "update") {
    return {
      kind: "updated",
      surgeryId: input.surgeryId,
      caseId: input.caseId,
      dryRun: true,
    };
  }
  return {
    kind: "published",
    surgeryId: input.surgeryId,
    caseId: input.caseId,
    action: "inserted",
    dryRun: true,
  };
}

export function classifyWritePublishResult(input: {
  surgeryId: string;
  caseId: string | null;
  result: PublishSurgeryCaseIntelligenceFactsResult;
}): SurgeryIntelligenceBackfillItemOutcome {
  if (input.result.action === "updated") {
    return {
      kind: "updated",
      surgeryId: input.surgeryId,
      caseId: input.caseId,
      dryRun: false,
    };
  }
  if (input.result.action === "skipped") {
    return {
      kind: "skipped_newer_version",
      surgeryId: input.surgeryId,
      caseId: input.caseId,
      reason: input.result.reason ?? "Publish skipped.",
    };
  }
  return {
    kind: "published",
    surgeryId: input.surgeryId,
    caseId: input.caseId,
    action: "inserted",
    dryRun: false,
  };
}

export function aggregateSurgeryIntelligenceBackfillSummary(input: {
  dryRun: boolean;
  scanned: number;
  outcomes: readonly SurgeryIntelligenceBackfillItemOutcome[];
}): SurgeryIntelligenceBackfillSummary {
  let eligible = 0;
  let published = 0;
  let updated = 0;
  let skippedNoFinalCount = 0;
  let skippedMissingContext = 0;
  let skippedNewerVersion = 0;
  let failed = 0;
  const failures: Array<{ surgeryId: string; reason: string }> = [];

  for (const outcome of input.outcomes) {
    switch (outcome.kind) {
      case "published":
        eligible += 1;
        published += 1;
        break;
      case "updated":
        eligible += 1;
        updated += 1;
        break;
      case "skipped_missing_context":
        skippedMissingContext += 1;
        break;
      case "skipped_no_final_count":
        skippedNoFinalCount += 1;
        break;
      case "skipped_newer_version":
        eligible += 1;
        skippedNewerVersion += 1;
        break;
      case "failed":
        failed += 1;
        failures.push({ surgeryId: outcome.surgeryId, reason: outcome.reason });
        break;
      default:
        break;
    }
  }

  return {
    dryRun: input.dryRun,
    scanned: input.scanned,
    eligible,
    published,
    updated,
    skippedNoFinalCount,
    skippedMissingContext,
    skippedNewerVersion,
    failed,
    failures,
  };
}