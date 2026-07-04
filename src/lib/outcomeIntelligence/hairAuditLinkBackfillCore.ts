/**
 * FI-OUTCOME-INTELLIGENCE-HAIRAUDIT-LINK-1 — optional idempotent HairAudit link backfill.
 */

import {
  buildStructuredHairAuditLinkFromLegacy,
  mergeAdditiveCaseHairAuditMetadata,
  parseLegacyHairAuditLinkMetadata,
  parseStructuredHairAuditLink,
  type StructuredHairAuditLink,
} from "./hairAuditLinkCore";

export type HairAuditLinkBackfillItemInput = {
  caseId: string;
  surgeryId: string;
  caseMetadata: Record<string, unknown>;
};

export type HairAuditLinkBackfillItemOutcome =
  | { kind: "dry_run_would_copy"; caseId: string; surgeryId: string }
  | { kind: "copied_legacy"; caseId: string; surgeryId: string; dryRun: boolean }
  | { kind: "skipped_no_legacy"; caseId: string; surgeryId: string }
  | { kind: "skipped_already_structured"; caseId: string; surgeryId: string }
  | { kind: "skipped_conflict"; caseId: string; surgeryId: string; detail: string };

export type HairAuditLinkBackfillSummary = {
  dryRun: boolean;
  scanned: number;
  wouldCopy: number;
  copied: number;
  skippedNoLegacy: number;
  skippedAlreadyStructured: number;
  skippedConflict: number;
};

export function planHairAuditLinkBackfillItem(
  input: HairAuditLinkBackfillItemInput & { dryRun: boolean }
): {
  outcome: HairAuditLinkBackfillItemOutcome;
  nextMetadata?: Record<string, unknown>;
  structuredLink?: StructuredHairAuditLink;
} {
  const caseId = input.caseId.trim();
  const surgeryId = input.surgeryId.trim();
  const legacy = parseLegacyHairAuditLinkMetadata(input.caseMetadata);
  const existingStructured = parseStructuredHairAuditLink(input.caseMetadata);

  if (existingStructured && !existingStructured.linkage_conflict) {
    return {
      outcome: { kind: "skipped_already_structured", caseId, surgeryId },
    };
  }

  if (existingStructured?.linkage_conflict) {
    return {
      outcome: {
        kind: "skipped_conflict",
        caseId,
        surgeryId,
        detail:
          existingStructured.linkage_conflict_detail ??
          "Existing structured linkage_conflict requires operator review.",
      },
    };
  }

  const structuredLink = buildStructuredHairAuditLinkFromLegacy({
    legacy,
    surgeryId,
  });
  if (!structuredLink) {
    return {
      outcome: { kind: "skipped_no_legacy", caseId, surgeryId },
    };
  }

  if (
    existingStructured?.hairaudit_case_id &&
    structuredLink.hairaudit_case_id &&
    existingStructured.hairaudit_case_id !== structuredLink.hairaudit_case_id
  ) {
    return {
      outcome: {
        kind: "skipped_conflict",
        caseId,
        surgeryId,
        detail: `Legacy case ${structuredLink.hairaudit_case_id} disagrees with structured ${existingStructured.hairaudit_case_id}.`,
      },
    };
  }

  const nextMetadata = mergeAdditiveCaseHairAuditMetadata(
    input.caseMetadata,
    structuredLink
  );

  if (input.dryRun) {
    return {
      outcome: { kind: "dry_run_would_copy", caseId, surgeryId },
      nextMetadata,
      structuredLink,
    };
  }

  return {
    outcome: { kind: "copied_legacy", caseId, surgeryId, dryRun: false },
    nextMetadata,
    structuredLink,
  };
}

export function aggregateHairAuditLinkBackfillSummary(
  outcomes: readonly HairAuditLinkBackfillItemOutcome[],
  dryRun: boolean
): HairAuditLinkBackfillSummary {
  const summary: HairAuditLinkBackfillSummary = {
    dryRun,
    scanned: outcomes.length,
    wouldCopy: 0,
    copied: 0,
    skippedNoLegacy: 0,
    skippedAlreadyStructured: 0,
    skippedConflict: 0,
  };

  for (const outcome of outcomes) {
    if (outcome.kind === "dry_run_would_copy") summary.wouldCopy += 1;
    if (outcome.kind === "copied_legacy") summary.copied += 1;
    if (outcome.kind === "skipped_no_legacy") summary.skippedNoLegacy += 1;
    if (outcome.kind === "skipped_already_structured") summary.skippedAlreadyStructured += 1;
    if (outcome.kind === "skipped_conflict") summary.skippedConflict += 1;
  }

  return summary;
}