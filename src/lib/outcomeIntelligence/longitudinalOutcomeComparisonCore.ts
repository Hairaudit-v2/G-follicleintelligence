/**
 * FI-OUTCOME-INTELLIGENCE-LONGITUDINAL-COMPARISON-1 — longitudinal surgery outcome comparison (pure).
 * Compares baseline/pre-op, immediate post-op, and follow-up imaging evidence over time.
 */

import {
  resolveHairAuditLinkForSurgery,
  type HairAuditLinkResolution,
  type ResolveHairAuditLinkForSurgeryInput,
} from "./hairAuditLinkCore";
import {
  classifySurgeryImagingGroup,
  type SurgeryImagingIntelligenceImageInput,
  type SurgeryImagingIntelligenceSummaryFacts,
} from "./surgeryImagingIntelligenceSummaryCore";

export const LONGITUDINAL_COMPARISON_WINDOWS = [
  "month_3",
  "month_6",
  "month_9",
  "month_12",
  "custom",
] as const;

export type LongitudinalComparisonWindow = (typeof LONGITUDINAL_COMPARISON_WINDOWS)[number];

export const LONGITUDINAL_EVIDENCE_STATUSES = [
  "not_started",
  "blocked_missing_evidence",
  "blocked_poor_quality",
  "ready_for_comparison",
  "outcome_measured",
] as const;

export type LongitudinalEvidenceStatus = (typeof LONGITUDINAL_EVIDENCE_STATUSES)[number];

export type LongitudinalImageSetSummary = {
  image_ids: string[];
  usable_image_count: number;
  poor_quality_count: number;
  present_views: string[];
  missing_required_views: string[];
  complete: boolean;
};

export type LongitudinalComparisonReadiness = {
  ready_for_comparison: boolean;
  outcome_measured: boolean;
  missing_comparison_views: string[];
};

export type FollowUpWindowStatus = {
  window: LongitudinalComparisonWindow;
  due: boolean;
  captured: boolean;
  captured_at: string | null;
  ready_for_comparison: boolean;
  outcome_measured: boolean;
};

export type LongitudinalOutcomeComparison = {
  baseline_image_set: LongitudinalImageSetSummary;
  immediate_post_op_image_set: LongitudinalImageSetSummary;
  follow_up_image_set: LongitudinalImageSetSummary;
  comparison_readiness: LongitudinalComparisonReadiness;
  donor_recovery_evidence_status: LongitudinalEvidenceStatus;
  recipient_growth_evidence_status: LongitudinalEvidenceStatus;
  before_after_ready: boolean;
  hairaudit_report_ready: boolean;
  follow_up_windows: FollowUpWindowStatus[];
  active_follow_up_window: LongitudinalComparisonWindow | null;
  missing_outcome_evidence: string[];
  hairaudit_case_id: string | null;
  hairaudit_report_id: string | null;
};

export type LongitudinalOutcomeSummaryFacts = LongitudinalOutcomeComparison;

export type BuildLongitudinalOutcomeComparisonInput = {
  tenantId: string;
  surgeryId: string;
  caseId?: string | null;
  patientId?: string | null;
  procedureDate?: string | null;
  images: readonly SurgeryImagingIntelligenceImageInput[];
  imagingSummary?: SurgeryImagingIntelligenceSummaryFacts | null;
  hairAuditLink?: ResolveHairAuditLinkForSurgeryInput | HairAuditLinkResolution;
  referenceDate?: string;
};

const BASELINE_COMPARISON_VIEWS = ["front", "top"] as const;
const IMMEDIATE_COMPARISON_VIEWS = ["front", "top"] as const;
const FOLLOW_UP_COMPARISON_VIEWS = ["front", "top"] as const;
const DONOR_BASELINE_VIEWS = ["donor"] as const;
const DONOR_FOLLOW_UP_VIEWS = ["donor"] as const;
const RECIPIENT_BASELINE_VIEWS = ["front", "top"] as const;
const RECIPIENT_FOLLOW_UP_VIEWS = ["front", "top"] as const;

const WINDOW_DUE_MONTHS: Record<Exclude<LongitudinalComparisonWindow, "custom">, number> = {
  month_3: 3,
  month_6: 6,
  month_9: 9,
  month_12: 12,
};

const POOR_QUALITY_STATUSES = new Set(["poor", "invalid", "fail", "review"]);

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function resolveCanonicalView(input: SurgeryImagingIntelligenceImageInput): string {
  const direct = readString(input.canonicalCategory);
  if (direct) return normalizeKey(direct);
  const region = readString(input.anatomicalRegion);
  if (region) return normalizeKey(region);
  const category = readString(input.imageCategory);
  return category ? normalizeKey(category) : "unknown";
}

function isImageUsable(input: SurgeryImagingIntelligenceImageInput): boolean {
  if (input.isClinicallyUsable === true) return true;
  if (input.isClinicallyUsable === false) return false;
  const quality = normalizeKey(readString(input.qualityStatus) ?? "");
  if (!quality || quality === "not_evaluated" || quality === "unknown") return true;
  return quality === "excellent" || quality === "acceptable" || quality === "suitable" || quality === "pass";
}

function isPoorQuality(input: SurgeryImagingIntelligenceImageInput): boolean {
  return POOR_QUALITY_STATUSES.has(normalizeKey(readString(input.qualityStatus) ?? ""));
}

function monthsSinceProcedure(procedureDate: string, referenceIso: string): number | null {
  const proc = Date.parse(`${procedureDate.trim()}T12:00:00.000Z`);
  const ref = Date.parse(referenceIso);
  if (!Number.isFinite(proc) || !Number.isFinite(ref)) return null;
  const diffMs = ref - proc;
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000));
}

export function resolveFollowUpComparisonWindow(
  input: SurgeryImagingIntelligenceImageInput
): LongitudinalComparisonWindow | null {
  const interval = normalizeKey(readString(input.followUpInterval) ?? "");
  const stage = normalizeKey(readString(input.procedureStage) ?? "");
  const visit = normalizeKey(readString(input.visitType) ?? "");
  const event = normalizeKey(readString(input.surgicalEvent) ?? "");

  const haystack = [interval, stage, visit, event].join(" ");
  if (haystack.includes("month_3") || haystack.includes("m3") || haystack === "3_month") {
    return "month_3";
  }
  if (haystack.includes("month_6") || haystack.includes("m6") || haystack === "6_month") {
    return "month_6";
  }
  if (haystack.includes("month_9") || haystack.includes("m9") || haystack === "9_month") {
    return "month_9";
  }
  if (
    haystack.includes("month_12") ||
    haystack.includes("m12") ||
    haystack.includes("12_month") ||
    haystack.includes("one_year")
  ) {
    return "month_12";
  }

  if (classifySurgeryImagingGroup(input) === "follow_up") return "custom";
  return null;
}

function buildImageSetSummary(input: {
  images: readonly SurgeryImagingIntelligenceImageInput[];
  requiredViews: readonly string[];
  groupFilter?: (image: SurgeryImagingIntelligenceImageInput) => boolean;
  windowFilter?: LongitudinalComparisonWindow | null;
}): LongitudinalImageSetSummary {
  const filtered = input.images.filter((image) => {
    if (input.groupFilter && !input.groupFilter(image)) return false;
    if (input.windowFilter) {
      const window = resolveFollowUpComparisonWindow(image);
      if (window !== input.windowFilter) return false;
    }
    return true;
  });

  const presentViews = new Set<string>();
  const imageIds: string[] = [];
  let usable = 0;
  let poor = 0;

  for (const image of filtered) {
    imageIds.push(image.imageId);
    presentViews.add(resolveCanonicalView(image));
    if (isImageUsable(image)) usable += 1;
    if (isPoorQuality(image)) poor += 1;
  }

  const missing = input.requiredViews.filter((view) => {
    const hasView = [...presentViews].some((present) => present === view || present.includes(view));
    const hasUsableForView = filtered.some(
      (image) =>
        isImageUsable(image) &&
        (resolveCanonicalView(image) === view || resolveCanonicalView(image).includes(view))
    );
    return !hasView || !hasUsableForView;
  });

  return {
    image_ids: imageIds,
    usable_image_count: usable,
    poor_quality_count: poor,
    present_views: [...presentViews].sort(),
    missing_required_views: [...missing],
    complete: usable > 0 && missing.length === 0,
  };
}

function resolveHairAuditLink(input: BuildLongitudinalOutcomeComparisonInput): HairAuditLinkResolution {
  if (input.hairAuditLink && "audit_readiness" in input.hairAuditLink) {
    return input.hairAuditLink;
  }
  return resolveHairAuditLinkForSurgery({
    tenantId: input.tenantId,
    surgeryId: input.surgeryId,
    caseId: input.caseId ?? null,
    patientId: input.patientId ?? null,
    ...(input.hairAuditLink ?? {}),
  });
}

function deriveEvidenceStatus(input: {
  baselineSet: LongitudinalImageSetSummary;
  followUpSet: LongitudinalImageSetSummary;
  followUpCaptured: boolean;
  strictMissingEvidence?: boolean;
}): LongitudinalEvidenceStatus {
  if (input.baselineSet.usable_image_count === 0) return "not_started";
  if (!input.followUpCaptured || input.followUpSet.usable_image_count === 0) {
    return "blocked_missing_evidence";
  }
  if (input.followUpSet.missing_required_views.length > 0) {
    return input.strictMissingEvidence ? "blocked_missing_evidence" : "ready_for_comparison";
  }
  if (input.followUpSet.poor_quality_count > 0 && input.followUpSet.usable_image_count === 0) {
    return "blocked_poor_quality";
  }
  if (input.followUpSet.poor_quality_count > 0) return "blocked_poor_quality";
  if (input.baselineSet.complete && input.followUpSet.complete) return "outcome_measured";
  return "ready_for_comparison";
}

function isDonorCanonicalView(image: SurgeryImagingIntelligenceImageInput): boolean {
  const view = resolveCanonicalView(image);
  return view === "donor" || view.includes("donor");
}

function isRecipientComparisonView(image: SurgeryImagingIntelligenceImageInput): boolean {
  const view = resolveCanonicalView(image);
  return view === "front" || view === "top" || view.includes("front") || view.includes("top");
}

function buildFollowUpWindowStatuses(input: {
  images: readonly SurgeryImagingIntelligenceImageInput[];
  procedureDate: string | null;
  referenceDate: string;
  baselineSet: LongitudinalImageSetSummary;
  immediateSet: LongitudinalImageSetSummary;
}): FollowUpWindowStatus[] {
  const monthsSince =
    input.procedureDate != null
      ? monthsSinceProcedure(input.procedureDate, input.referenceDate)
      : null;

  return LONGITUDINAL_COMPARISON_WINDOWS.map((window) => {
    const followUpSet = buildImageSetSummary({
      images: input.images,
      requiredViews: FOLLOW_UP_COMPARISON_VIEWS,
      groupFilter: (image) => classifySurgeryImagingGroup(image) === "follow_up",
      windowFilter: window,
    });

    const windowImages = input.images.filter((image) => {
      if (classifySurgeryImagingGroup(image) !== "follow_up") return false;
      return resolveFollowUpComparisonWindow(image) === window;
    });
    const captured = followUpSet.usable_image_count > 0;
    const capturedAt =
      windowImages
        .map((image) => readString(image.capturedAt))
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;

    const dueMonths = window === "custom" ? null : WINDOW_DUE_MONTHS[window];
    const due = dueMonths != null && monthsSince != null && monthsSince >= dueMonths && !captured;

    const readyForComparison =
      input.baselineSet.usable_image_count > 0 &&
      input.immediateSet.usable_image_count > 0 &&
      captured &&
      followUpSet.missing_required_views.length === 0 &&
      followUpSet.poor_quality_count === 0;

    const outcomeMeasured =
      readyForComparison &&
      input.baselineSet.complete &&
      input.immediateSet.complete &&
      followUpSet.complete;

    return {
      window,
      due,
      captured,
      captured_at: capturedAt,
      ready_for_comparison: readyForComparison,
      outcome_measured: outcomeMeasured,
    };
  });
}

function selectActiveFollowUpWindow(
  windows: readonly FollowUpWindowStatus[]
): LongitudinalComparisonWindow | null {
  const priority: LongitudinalComparisonWindow[] = [
    "month_12",
    "month_9",
    "month_6",
    "month_3",
    "custom",
  ];
  for (const window of priority) {
    const status = windows.find((entry) => entry.window === window);
    if (status?.captured) return window;
  }
  for (const window of priority) {
    const status = windows.find((entry) => entry.window === window);
    if (status?.due) return window;
  }
  return null;
}

export function buildLongitudinalOutcomeComparison(
  input: BuildLongitudinalOutcomeComparisonInput
): LongitudinalOutcomeComparison {
  const referenceDate = input.referenceDate ?? new Date().toISOString();
  const hairAuditLink = resolveHairAuditLink(input);

  const baselineSet = buildImageSetSummary({
    images: input.images,
    requiredViews: BASELINE_COMPARISON_VIEWS,
    groupFilter: (image) => classifySurgeryImagingGroup(image) === "baseline_pre_op",
  });
  const immediateSet = buildImageSetSummary({
    images: input.images,
    requiredViews: IMMEDIATE_COMPARISON_VIEWS,
    groupFilter: (image) => classifySurgeryImagingGroup(image) === "immediate_post_op",
  });
  const followUpWindows = buildFollowUpWindowStatuses({
    images: input.images,
    procedureDate: input.procedureDate ?? null,
    referenceDate,
    baselineSet,
    immediateSet,
  });
  const activeWindow = selectActiveFollowUpWindow(followUpWindows);
  const followUpSet = buildImageSetSummary({
    images: input.images,
    requiredViews: FOLLOW_UP_COMPARISON_VIEWS,
    groupFilter: (image) => classifySurgeryImagingGroup(image) === "follow_up",
    windowFilter: activeWindow,
  });

  const followUpCaptured = followUpSet.usable_image_count > 0;
  const donorBaseline = buildImageSetSummary({
    images: input.images,
    requiredViews: DONOR_BASELINE_VIEWS,
    groupFilter: (image) => classifySurgeryImagingGroup(image) === "donor",
  });
  const donorFollowUp = buildImageSetSummary({
    images: input.images,
    requiredViews: DONOR_FOLLOW_UP_VIEWS,
    groupFilter: (image) =>
      classifySurgeryImagingGroup(image) === "follow_up" && isDonorCanonicalView(image),
    windowFilter: activeWindow,
  });
  const recipientBaseline = buildImageSetSummary({
    images: input.images,
    requiredViews: RECIPIENT_BASELINE_VIEWS,
    groupFilter: (image) =>
      classifySurgeryImagingGroup(image) === "baseline_pre_op" ||
      classifySurgeryImagingGroup(image) === "recipient",
  });
  const recipientFollowUp = buildImageSetSummary({
    images: input.images,
    requiredViews: RECIPIENT_FOLLOW_UP_VIEWS,
    groupFilter: (image) =>
      classifySurgeryImagingGroup(image) === "follow_up" && isRecipientComparisonView(image),
    windowFilter: activeWindow,
  });

  const missingComparisonViews = [
    ...baselineSet.missing_required_views.map((view) => `baseline:${view}`),
    ...immediateSet.missing_required_views.map((view) => `immediate_post_op:${view}`),
    ...followUpSet.missing_required_views.map((view) => `follow_up:${view}`),
  ];

  const readyForComparison =
    baselineSet.usable_image_count > 0 &&
    immediateSet.usable_image_count > 0 &&
    followUpCaptured &&
    followUpSet.missing_required_views.length === 0 &&
    followUpSet.poor_quality_count === 0 &&
    !hairAuditLink.linkage_conflict;

  const outcomeMeasured =
    readyForComparison &&
    baselineSet.complete &&
    immediateSet.complete &&
    followUpSet.complete;

  const donorRecoveryStatus = deriveEvidenceStatus({
    baselineSet: donorBaseline,
    followUpSet: donorFollowUp,
    followUpCaptured,
    strictMissingEvidence: true,
  });
  const recipientGrowthStatus = deriveEvidenceStatus({
    baselineSet: recipientBaseline,
    followUpSet: recipientFollowUp,
    followUpCaptured,
    strictMissingEvidence: true,
  });

  const imagingBeforeAfterReady =
    input.imagingSummary?.audit_readiness.before_after_ready ??
    (baselineSet.usable_image_count > 0 &&
      immediateSet.usable_image_count > 0 &&
      (followUpCaptured ||
        (input.procedureDate != null &&
          (monthsSinceProcedure(input.procedureDate, referenceDate) ?? 0) >= 10)));

  const beforeAfterReady =
    imagingBeforeAfterReady &&
    baselineSet.missing_required_views.length === 0 &&
    immediateSet.missing_required_views.length === 0 &&
    !hairAuditLink.linkage_conflict;

  const month12Window = followUpWindows.find((entry) => entry.window === "month_12");
  const hairAuditReportReady = Boolean(
    month12Window?.outcome_measured &&
      hairAuditLink.hairaudit_case_id &&
      (hairAuditLink.fi_report_id || hairAuditLink.audit_report_id) &&
      !hairAuditLink.linkage_conflict
  );

  const missingOutcomeEvidence: string[] = [];
  if (baselineSet.missing_required_views.length) {
    missingOutcomeEvidence.push("baseline_comparison_views");
  }
  if (immediateSet.missing_required_views.length) {
    missingOutcomeEvidence.push("immediate_post_op_comparison_views");
  }
  if (!followUpCaptured) missingOutcomeEvidence.push("follow_up_evidence");
  if (followUpSet.missing_required_views.length) {
    missingOutcomeEvidence.push("follow_up_comparison_views");
  }
  if (followUpSet.poor_quality_count > 0) missingOutcomeEvidence.push("follow_up_poor_quality");
  if (donorFollowUp.missing_required_views.length) {
    missingOutcomeEvidence.push("donor_follow_up");
  }
  if (recipientFollowUp.missing_required_views.length) {
    missingOutcomeEvidence.push("recipient_follow_up");
  }
  if (!hairAuditLink.hairaudit_case_id) missingOutcomeEvidence.push("hairaudit_link");
  if (hairAuditLink.linkage_conflict) missingOutcomeEvidence.push("hairaudit_linkage_conflict");
  if (hairAuditReportReady === false && month12Window?.captured) {
    missingOutcomeEvidence.push("hairaudit_report");
  }

  return {
    baseline_image_set: baselineSet,
    immediate_post_op_image_set: immediateSet,
    follow_up_image_set: followUpSet,
    comparison_readiness: {
      ready_for_comparison: readyForComparison,
      outcome_measured: outcomeMeasured,
      missing_comparison_views: missingComparisonViews,
    },
    donor_recovery_evidence_status: donorRecoveryStatus,
    recipient_growth_evidence_status: recipientGrowthStatus,
    before_after_ready: beforeAfterReady,
    hairaudit_report_ready: hairAuditReportReady,
    follow_up_windows: followUpWindows,
    active_follow_up_window: activeWindow,
    missing_outcome_evidence: [...new Set(missingOutcomeEvidence)],
    hairaudit_case_id: hairAuditLink.hairaudit_case_id,
    hairaudit_report_id: hairAuditLink.fi_report_id ?? hairAuditLink.audit_report_id,
  };
}

export function toLongitudinalOutcomeSummaryFacts(
  comparison: LongitudinalOutcomeComparison | null
): LongitudinalOutcomeSummaryFacts | null {
  if (!comparison) return null;
  return comparison;
}

export function formatLongitudinalEvidenceStatusLabel(status: LongitudinalEvidenceStatus): string {
  switch (status) {
    case "outcome_measured":
      return "Outcome measured";
    case "ready_for_comparison":
      return "Ready for comparison";
    case "blocked_poor_quality":
      return "Blocked — poor quality";
    case "blocked_missing_evidence":
      return "Blocked — missing evidence";
    default:
      return "Not started";
  }
}

export function formatLongitudinalComparisonReadinessLabel(
  readiness: Pick<LongitudinalComparisonReadiness, "outcome_measured" | "ready_for_comparison">
): string {
  if (readiness.outcome_measured) return "Outcome measured";
  if (readiness.ready_for_comparison) return "Ready for comparison";
  return "Building evidence";
}

export function isDonorRecoveryReady(comparison: LongitudinalOutcomeComparison): boolean {
  return (
    comparison.donor_recovery_evidence_status === "outcome_measured" ||
    comparison.donor_recovery_evidence_status === "ready_for_comparison"
  );
}

export function isRecipientGrowthReady(comparison: LongitudinalOutcomeComparison): boolean {
  return (
    comparison.recipient_growth_evidence_status === "outcome_measured" ||
    comparison.recipient_growth_evidence_status === "ready_for_comparison"
  );
}

export function isCaseDueForFollowUp(comparison: LongitudinalOutcomeComparison): boolean {
  return comparison.follow_up_windows.some((window) => window.due);
}