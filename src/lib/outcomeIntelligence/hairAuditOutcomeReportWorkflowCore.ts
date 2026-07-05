/**
 * FI-HAIRAUDIT-OUTCOME-REPORT-WORKFLOW-1 — HairAudit outcome report workflow from surgery intelligence.
 * Pure resolver: longitudinal facts + HairAudit link context → operator workflow state.
 */

import {
  buildFiAuditReportHref,
  buildStructuredHairAuditLinkFromResolution,
  mergeAdditiveCaseHairAuditMetadata,
  parseLegacyHairAuditLinkMetadata,
  parseStructuredHairAuditLink,
  type HairAuditLinkResolution,
  type StructuredHairAuditLink,
} from "./hairAuditLinkCore";
import type { LongitudinalOutcomeSummaryFacts } from "./longitudinalOutcomeComparisonCore";
import type { SurgeryCaseIntelligenceFacts } from "./surgeryCaseFactsCore";

export const HAIRAUDIT_OUTCOME_REPORT_STATUSES = [
  "not_started",
  "missing_evidence",
  "ready_for_review",
  "in_review",
  "report_complete",
  "linkage_conflict",
] as const;

export type HairAuditOutcomeReportStatus = (typeof HAIRAUDIT_OUTCOME_REPORT_STATUSES)[number];

export const HAIRAUDIT_OUTCOME_REPORT_ACTIONS = [
  "open_report",
  "create_or_link_report",
  "send_to_hairaudit_review",
  "mark_missing_follow_up_imaging",
  "view_missing_evidence_checklist",
] as const;

export type HairAuditOutcomeReportAction = (typeof HAIRAUDIT_OUTCOME_REPORT_ACTIONS)[number];

export type HairAuditOutcomeReportContext = {
  fiReportId?: string | null;
  reportStatus?: string | null;
};

export type ResolveHairAuditOutcomeReportWorkflowInput = {
  tenantId: string;
  facts: Pick<
    SurgeryCaseIntelligenceFacts,
    | "longitudinal_outcome_summary"
    | "missing_outcome_evidence"
    | "before_after_ready"
    | "donor_recovery_ready"
    | "recipient_growth_ready"
  >;
  hairAuditLink: HairAuditLinkResolution;
  reportContext?: HairAuditOutcomeReportContext | null;
};

export type HairAuditOutcomeReportWorkflow = {
  report_ready: boolean;
  report_status: HairAuditOutcomeReportStatus;
  missing_evidence: string[];
  report_link: string | null;
  recommended_action: HairAuditOutcomeReportAction;
  available_actions: HairAuditOutcomeReportAction[];
};

const FOLLOW_UP_MISSING_KEYS = new Set([
  "follow_up_evidence",
  "follow_up_comparison_views",
  "follow_up_poor_quality",
  "donor_follow_up",
  "recipient_follow_up",
]);

const COMPLETE_REPORT_STATUSES = new Set(["complete", "completed", "published", "final"]);
const IN_REVIEW_REPORT_STATUSES = new Set([
  "in_review",
  "review",
  "reviewing",
  "draft",
  "pending_review",
]);

function normalizeReportStatus(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function collectHairAuditOutcomeMissingEvidence(input: {
  facts: ResolveHairAuditOutcomeReportWorkflowInput["facts"];
  hairAuditLink: HairAuditLinkResolution;
}): string[] {
  const missing = new Set<string>([
    ...(input.facts.missing_outcome_evidence ?? []),
    ...(input.facts.longitudinal_outcome_summary?.missing_outcome_evidence ?? []),
  ]);

  if (!input.hairAuditLink.hairaudit_case_id) missing.add("hairaudit_link");
  if (input.hairAuditLink.linkage_conflict) missing.add("hairaudit_linkage_conflict");

  const longitudinal = input.facts.longitudinal_outcome_summary;
  if (longitudinal && !longitudinal.comparison_readiness.outcome_measured) {
    if (longitudinal.comparison_readiness.missing_comparison_views.length) {
      missing.add("comparison_views");
    }
  }
  if (longitudinal?.hairaudit_report_ready === false && longitudinal.follow_up_windows.some((w) => w.window === "month_12" && w.captured)) {
    if (!input.hairAuditLink.fi_report_id && !input.hairAuditLink.audit_report_id) {
      missing.add("hairaudit_report");
    }
  }

  return [...missing];
}

function resolveReportLink(input: {
  tenantId: string;
  hairAuditLink: HairAuditLinkResolution;
  reportContext?: HairAuditOutcomeReportContext | null;
}): string | null {
  if (input.hairAuditLink.linkage_conflict) return null;
  const reportId =
    input.hairAuditLink.fi_report_id ??
    input.hairAuditLink.audit_report_id ??
    input.reportContext?.fiReportId ??
    null;
  if (!reportId || !input.tenantId.trim()) return null;
  return buildFiAuditReportHref(input.tenantId, reportId);
}

function hasFollowUpImagingGap(missingEvidence: readonly string[]): boolean {
  return missingEvidence.some((key) => FOLLOW_UP_MISSING_KEYS.has(key));
}

function deriveAvailableActions(input: {
  workflow: Omit<HairAuditOutcomeReportWorkflow, "available_actions" | "recommended_action">;
  missingEvidence: readonly string[];
}): HairAuditOutcomeReportAction[] {
  const actions = new Set<HairAuditOutcomeReportAction>();

  if (input.workflow.report_status === "linkage_conflict") {
    actions.add("view_missing_evidence_checklist");
    return [...actions];
  }

  if (input.workflow.report_link) {
    actions.add("open_report");
  }

  if (
    input.workflow.report_status === "ready_for_review" ||
    (input.workflow.report_ready && !input.workflow.report_link)
  ) {
    actions.add("create_or_link_report");
  }

  if (
    input.workflow.report_link &&
    (input.workflow.report_status === "ready_for_review" ||
      input.workflow.report_status === "in_review")
  ) {
    actions.add("send_to_hairaudit_review");
  }

  if (hasFollowUpImagingGap(input.missingEvidence)) {
    actions.add("mark_missing_follow_up_imaging");
  }

  if (input.missingEvidence.length > 0) {
    actions.add("view_missing_evidence_checklist");
  }

  if (!actions.size) {
    actions.add("view_missing_evidence_checklist");
  }

  return [...actions];
}

function deriveRecommendedAction(input: {
  reportStatus: HairAuditOutcomeReportStatus;
  reportLink: string | null;
  missingEvidence: readonly string[];
  reportReady: boolean;
}): HairAuditOutcomeReportAction {
  if (input.reportStatus === "linkage_conflict") return "view_missing_evidence_checklist";
  if (input.reportStatus === "report_complete" && input.reportLink) return "open_report";
  if (input.reportLink && input.reportStatus === "in_review") return "open_report";
  if (input.reportStatus === "ready_for_review" && !input.reportLink) {
    return "create_or_link_report";
  }
  if (input.reportStatus === "ready_for_review" && input.reportLink) {
    return "send_to_hairaudit_review";
  }
  if (hasFollowUpImagingGap(input.missingEvidence)) return "mark_missing_follow_up_imaging";
  if (input.reportLink && input.reportReady) return "open_report";
  return "view_missing_evidence_checklist";
}

export function resolveHairAuditOutcomeReportWorkflow(
  input: ResolveHairAuditOutcomeReportWorkflowInput
): HairAuditOutcomeReportWorkflow {
  const longitudinal = input.facts.longitudinal_outcome_summary;
  const missingEvidence = collectHairAuditOutcomeMissingEvidence({
    facts: input.facts,
    hairAuditLink: input.hairAuditLink,
  });
  const reportLink = resolveReportLink({
    tenantId: input.tenantId,
    hairAuditLink: input.hairAuditLink,
    reportContext: input.reportContext,
  });
  const normalizedReportStatus = normalizeReportStatus(input.reportContext?.reportStatus);

  let reportStatus: HairAuditOutcomeReportStatus;

  if (input.hairAuditLink.linkage_conflict) {
    reportStatus = "linkage_conflict";
  } else if (reportLink && normalizedReportStatus && COMPLETE_REPORT_STATUSES.has(normalizedReportStatus)) {
    reportStatus = "report_complete";
  } else if (reportLink && normalizedReportStatus && IN_REVIEW_REPORT_STATUSES.has(normalizedReportStatus)) {
    reportStatus = "in_review";
  } else if (longitudinal?.hairaudit_report_ready) {
    reportStatus = reportLink ? "in_review" : "ready_for_review";
  } else if (
    longitudinal?.comparison_readiness.outcome_measured &&
    reportLink &&
    !missingEvidence.includes("hairaudit_linkage_conflict")
  ) {
    reportStatus = "in_review";
  } else if (
    longitudinal?.comparison_readiness.ready_for_comparison &&
    missingEvidence.filter((key) => !key.startsWith("hairaudit")).length === 0 &&
    input.hairAuditLink.hairaudit_case_id
  ) {
    reportStatus = "ready_for_review";
  } else if (missingEvidence.length > 0) {
    reportStatus = "missing_evidence";
  } else {
    reportStatus = "not_started";
  }

  const reportReady = Boolean(
    !input.hairAuditLink.linkage_conflict &&
      (longitudinal?.hairaudit_report_ready ||
        (reportStatus === "report_complete" && reportLink) ||
        (longitudinal?.comparison_readiness.outcome_measured && reportLink))
  );

  const partial = {
    report_ready: reportReady,
    report_status: reportStatus,
    missing_evidence: missingEvidence,
    report_link: reportLink,
  };

  const recommended_action = deriveRecommendedAction({
    reportStatus,
    reportLink,
    missingEvidence,
    reportReady,
  });

  return {
    ...partial,
    recommended_action,
    available_actions: deriveAvailableActions({ workflow: partial, missingEvidence }),
  };
}

export function formatHairAuditOutcomeReportStatusLabel(
  status: HairAuditOutcomeReportStatus
): string {
  switch (status) {
    case "report_complete":
      return "Report complete";
    case "in_review":
      return "In review";
    case "ready_for_review":
      return "Ready for review";
    case "missing_evidence":
      return "Missing evidence";
    case "linkage_conflict":
      return "Conflict — review";
    default:
      return "Not started";
  }
}

export function formatHairAuditOutcomeReportActionLabel(
  action: HairAuditOutcomeReportAction
): string {
  switch (action) {
    case "open_report":
      return "Open report";
    case "create_or_link_report":
      return "Create / link report";
    case "send_to_hairaudit_review":
      return "Send to HairAudit review";
    case "mark_missing_follow_up_imaging":
      return "Mark missing follow-up";
    case "view_missing_evidence_checklist":
      return "View evidence checklist";
    default:
      return action;
  }
}

export type PlanHairAuditOutcomeReportLinkInput = {
  tenantId: string;
  surgeryId: string;
  caseId: string;
  caseMetadata: Record<string, unknown>;
  hairAuditLink: HairAuditLinkResolution;
  fiReportId?: string | null;
  dryRun: boolean;
  sendToReview?: boolean;
};

export type PlanHairAuditOutcomeReportLinkOutcome =
  | { kind: "dry_run_would_link"; fiReportId: string }
  | { kind: "linked"; fiReportId: string; dryRun: boolean }
  | { kind: "skipped_legacy_report"; fiReportId: string }
  | { kind: "skipped_already_linked"; fiReportId: string }
  | { kind: "skipped_conflict" }
  | { kind: "skipped_no_report" }
  | { kind: "skipped_no_case_link" };

export function planHairAuditOutcomeReportLink(input: PlanHairAuditOutcomeReportLinkInput): {
  outcome: PlanHairAuditOutcomeReportLinkOutcome;
  nextMetadata?: Record<string, unknown>;
  structuredLink?: StructuredHairAuditLink;
} {
  const caseId = input.caseId.trim();
  const surgeryId = input.surgeryId.trim();

  if (input.hairAuditLink.linkage_conflict) {
    return { outcome: { kind: "skipped_conflict" } };
  }

  if (!input.hairAuditLink.hairaudit_case_id) {
    return { outcome: { kind: "skipped_no_case_link" } };
  }

  const legacy = parseLegacyHairAuditLinkMetadata(input.caseMetadata);
  const legacyReportId = legacy.fi_report_id ?? legacy.audit_report_id;

  if (
    legacyReportId &&
    input.fiReportId &&
    input.fiReportId.trim() !== legacyReportId
  ) {
    return {
      outcome: { kind: "skipped_legacy_report", fiReportId: legacyReportId },
    };
  }

  const candidateReportId =
    legacyReportId ??
    input.hairAuditLink.fi_report_id ??
    input.hairAuditLink.audit_report_id ??
    input.fiReportId ??
    null;

  if (!candidateReportId) {
    return { outcome: { kind: "skipped_no_report" } };
  }

  const existingStructured = parseStructuredHairAuditLink(input.caseMetadata);
  const structuredReportId =
    existingStructured?.fi_report_id ?? existingStructured?.audit_report_id ?? null;

  if (legacyReportId && structuredReportId && legacyReportId !== structuredReportId) {
    return { outcome: { kind: "skipped_conflict" } };
  }

  if (
    structuredReportId === candidateReportId ||
    (legacyReportId && legacyReportId === candidateReportId && existingStructured?.fi_report_id)
  ) {
    return {
      outcome: { kind: "skipped_already_linked", fiReportId: candidateReportId },
    };
  }

  if (legacyReportId && !structuredReportId) {
    const structuredLink = buildStructuredHairAuditLinkFromResolution({
      resolution: {
        ...input.hairAuditLink,
        fi_report_id: legacyReportId,
        audit_report_id: legacy.audit_report_id ?? legacyReportId,
        ...(input.sendToReview
          ? { patient_review_pathway: "hairaudit_outcome_review" }
          : {}),
      },
      surgeryId,
    });
    if (!structuredLink) {
      return { outcome: { kind: "skipped_no_report" } };
    }
    const nextMetadata = mergeAdditiveCaseHairAuditMetadata(input.caseMetadata, structuredLink);
    if (input.dryRun) {
      return {
        outcome: { kind: "dry_run_would_link", fiReportId: legacyReportId },
        nextMetadata,
        structuredLink,
      };
    }
    return {
      outcome: { kind: "linked", fiReportId: legacyReportId, dryRun: false },
      nextMetadata,
      structuredLink,
    };
  }

  const structuredLink = buildStructuredHairAuditLinkFromResolution({
    resolution: {
      ...input.hairAuditLink,
      fi_report_id: candidateReportId,
      audit_report_id: input.hairAuditLink.audit_report_id ?? candidateReportId,
      ...(input.sendToReview ? { patient_review_pathway: "hairaudit_outcome_review" } : {}),
    },
    surgeryId,
  });
  if (!structuredLink) {
    return { outcome: { kind: "skipped_no_report" } };
  }

  if (legacyReportId) {
    return {
      outcome: { kind: "skipped_legacy_report", fiReportId: legacyReportId },
    };
  }

  const nextMetadata = mergeAdditiveCaseHairAuditMetadata(input.caseMetadata, structuredLink);

  if (input.dryRun) {
    return {
      outcome: { kind: "dry_run_would_link", fiReportId: candidateReportId },
      nextMetadata,
      structuredLink,
    };
  }

  return {
    outcome: { kind: "linked", fiReportId: candidateReportId, dryRun: false },
    nextMetadata,
    structuredLink,
  };
}

export function surgeryFactsToOutcomeWorkflowInput(
  facts: SurgeryCaseIntelligenceFacts
): ResolveHairAuditOutcomeReportWorkflowInput["facts"] {
  return {
    longitudinal_outcome_summary: facts.longitudinal_outcome_summary,
    missing_outcome_evidence: facts.missing_outcome_evidence,
    before_after_ready: facts.before_after_ready,
    donor_recovery_ready: facts.donor_recovery_ready,
    recipient_growth_ready: facts.recipient_growth_ready,
  };
}

export function buildOutcomeReportWorkflowFromFacts(input: {
  tenantId: string;
  facts: SurgeryCaseIntelligenceFacts;
  hairAuditLink: HairAuditLinkResolution;
  reportContext?: HairAuditOutcomeReportContext | null;
}): HairAuditOutcomeReportWorkflow {
  return resolveHairAuditOutcomeReportWorkflow({
    tenantId: input.tenantId,
    facts: surgeryFactsToOutcomeWorkflowInput(input.facts),
    hairAuditLink: input.hairAuditLink,
    reportContext: input.reportContext,
  });
}