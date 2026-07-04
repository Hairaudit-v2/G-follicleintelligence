/**
 * FI-OUTCOME-INTELLIGENCE-SURGERY-IMAGING-SUMMARY-1 — surgery imaging set intelligence (pure).
 * Extends Surgery Intelligence beyond graft-tray counts with baseline, donor, recipient,
 * immediate post-op, follow-up groups, and HairAudit-compatible audit readiness.
 */

import { mapExternalCategoryToCanonical } from "@/src/lib/imaging-os/categories";
import {
  normalizeSurgicalImageEventType,
  type ImagingOsSurgicalImageEventType,
} from "@/src/lib/imaging-os/surgical";
import {
  deriveHairAuditAuditReadiness,
  resolveHairAuditLinkForSurgery,
  type HairAuditLinkResolution,
  type ResolveHairAuditLinkForSurgeryInput,
} from "./hairAuditLinkCore";

export const SURGERY_IMAGING_INTELLIGENCE_GROUPS = [
  "baseline_pre_op",
  "donor",
  "recipient",
  "graft_tray",
  "immediate_post_op",
  "follow_up",
] as const;

export type SurgeryImagingIntelligenceGroup =
  (typeof SURGERY_IMAGING_INTELLIGENCE_GROUPS)[number];

export const SURGERY_IMAGING_GROUP_LABELS: Record<SurgeryImagingIntelligenceGroup, string> = {
  baseline_pre_op: "Baseline / pre-op",
  donor: "Donor",
  recipient: "Recipient",
  graft_tray: "Graft tray",
  immediate_post_op: "Immediate post-op",
  follow_up: "Follow-up",
};

export type SurgeryImagingIntelligenceImageInput = {
  imageId: string;
  canonicalCategory?: string | null;
  surgicalEvent?: string | null;
  procedureStage?: string | null;
  captureSource?: string | null;
  imageCategory?: string | null;
  anatomicalRegion?: string | null;
  visitType?: string | null;
  followUpInterval?: string | null;
  qualityStatus?: string | null;
  isClinicallyUsable?: boolean | null;
  capturedAt?: string | null;
};

export type SurgeryImagingGroupSummary = {
  group: SurgeryImagingIntelligenceGroup;
  image_count: number;
  usable_image_count: number;
  poor_quality_count: number;
  image_ids: string[];
  present_views: string[];
  missing_required_views: string[];
  complete: boolean;
};

export type SurgeryImagingAuditReadiness = {
  baseline_present: boolean;
  donor_set_complete: boolean;
  recipient_set_complete: boolean;
  immediate_post_op_present: boolean;
  follow_up_captured_or_due: boolean;
  reviewed_graft_count_present: boolean;
  hairaudit_link_resolved: boolean;
  hairaudit_linkage_conflict: boolean;
  before_after_ready: boolean;
  overall_audit_ready: boolean;
  missing_requirements: string[];
};

export type SurgeryImagingIntelligenceSummary = {
  groups: SurgeryImagingGroupSummary[];
  missing_required_views: string[];
  poor_quality_image_ids: string[];
  audit_readiness: SurgeryImagingAuditReadiness;
  completeness_score: number;
  hairaudit_case_id: string | null;
  hairaudit_link_origin: HairAuditLinkResolution["link_origin"];
};

export type SurgeryImagingIntelligenceSummaryFacts = {
  groups: SurgeryImagingGroupSummary[];
  missing_required_views: string[];
  poor_quality_image_ids: string[];
  audit_readiness: SurgeryImagingAuditReadiness;
  completeness_score: number;
  hairaudit_case_id: string | null;
  hairaudit_link_origin: HairAuditLinkResolution["link_origin"];
};

export type BuildSurgeryImagingIntelligenceSummaryInput = {
  tenantId: string;
  surgeryId: string;
  caseId?: string | null;
  patientId?: string | null;
  procedureDate?: string | null;
  images: readonly SurgeryImagingIntelligenceImageInput[];
  hasReviewedGraftCount: boolean;
  hairAuditLink?: ResolveHairAuditLinkForSurgeryInput | HairAuditLinkResolution;
  followUpDueAfterMonths?: number;
  referenceDate?: string;
};

const GROUP_REQUIRED_VIEWS: Record<SurgeryImagingIntelligenceGroup, readonly string[]> = {
  baseline_pre_op: ["front", "top", "crown"],
  donor: ["donor"],
  recipient: ["front", "top", "recipient"],
  graft_tray: ["graft_tray"],
  immediate_post_op: ["front", "top"],
  follow_up: ["front", "top", "crown"],
};

const POOR_QUALITY_STATUSES = new Set(["poor", "invalid", "fail", "review"]);

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeViewKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function resolveCanonicalCategory(input: SurgeryImagingIntelligenceImageInput): string {
  const direct = readString(input.canonicalCategory);
  if (direct) return normalizeViewKey(direct);

  const category = readString(input.imageCategory);
  if (category) {
    try {
      return normalizeViewKey(mapExternalCategoryToCanonical(category).canonical);
    } catch {
      return normalizeViewKey(category);
    }
  }

  const region = readString(input.anatomicalRegion);
  if (region) return normalizeViewKey(region);

  return "unknown";
}

function resolveSurgicalEvent(input: SurgeryImagingIntelligenceImageInput): ImagingOsSurgicalImageEventType {
  const explicit = readString(input.surgicalEvent);
  if (explicit) return normalizeSurgicalImageEventType(explicit);

  const stage = normalizeViewKey(readString(input.procedureStage) ?? "");
  if (stage.includes("follow_up") || stage.includes("followup")) return "month_12_outcome";
  if (stage.includes("immediate_post") || stage === "immediate_post_op") return "immediate_post_op";
  if (stage.includes("post_op") || stage === "post_op") return "immediate_post_op";
  if (stage.includes("graft_tray") || stage === "graft_tray") return "graft_tray";
  if (stage.includes("donor")) return "donor_mapping";
  if (stage.includes("recipient") || stage.includes("implant")) return "recipient_design";
  if (stage.includes("baseline") || stage.includes("pre_op") || stage === "preop") return "pre_op";

  const visit = normalizeViewKey(readString(input.visitType) ?? "");
  if (visit.includes("follow_up") || visit.includes("followup")) return "month_12_outcome";
  if (visit.includes("post_op")) return "immediate_post_op";
  if (visit.includes("baseline") || visit.includes("pre_op")) return "pre_op";

  const followUp = normalizeViewKey(readString(input.followUpInterval) ?? "");
  if (followUp.includes("month") || followUp.includes("m12") || followUp.includes("12")) {
    return "month_12_outcome";
  }
  if (followUp.includes("month_6") || followUp === "m6") return "month_6_review";
  if (followUp.includes("month_3") || followUp === "m3") return "month_3_review";

  const capture = normalizeViewKey(readString(input.captureSource) ?? "");
  if (capture.includes("graft_tray")) return "graft_tray";

  const view = resolveCanonicalCategory(input);
  if (view === "graft_tray") return "graft_tray";
  if (view === "donor") return "donor_mapping";
  if (view === "recipient") return "recipient_design";

  return "unknown";
}

export function classifySurgeryImagingGroup(
  input: SurgeryImagingIntelligenceImageInput
): SurgeryImagingIntelligenceGroup | null {
  const event = resolveSurgicalEvent(input);
  const view = resolveCanonicalCategory(input);

  if (event === "graft_tray" || view === "graft_tray") return "graft_tray";
  if (
    event === "month_12_outcome" ||
    event === "month_6_review" ||
    event === "month_3_review" ||
    event === "day_14_review"
  ) {
    return "follow_up";
  }
  if (event === "immediate_post_op") return "immediate_post_op";
  if (event === "donor_mapping" || event === "extraction_documentation" || view === "donor") {
    return "donor";
  }
  if (
    event === "recipient_design" ||
    event === "implantation_documentation" ||
    event === "implantation_complete" ||
    view === "recipient"
  ) {
    return "recipient";
  }
  if (event === "pre_op") {
    if (view === "donor") return "donor";
    if (view === "recipient" || view === "front" || view === "top" || view === "crown") {
      return view === "recipient" ? "recipient" : "baseline_pre_op";
    }
    return "baseline_pre_op";
  }

  if (view === "donor") return "donor";
  if (view === "recipient") return "recipient";
  if (view === "graft_tray") return "graft_tray";

  return null;
}

function isImageUsable(input: SurgeryImagingIntelligenceImageInput): boolean {
  if (input.isClinicallyUsable === true) return true;
  if (input.isClinicallyUsable === false) return false;
  const quality = normalizeViewKey(readString(input.qualityStatus) ?? "");
  if (!quality || quality === "not_evaluated" || quality === "unknown") return true;
  return quality === "excellent" || quality === "acceptable" || quality === "suitable" || quality === "pass";
}

function isPoorQuality(input: SurgeryImagingIntelligenceImageInput): boolean {
  const quality = normalizeViewKey(readString(input.qualityStatus) ?? "");
  return POOR_QUALITY_STATUSES.has(quality);
}

function monthsSinceProcedure(procedureDate: string, referenceIso: string): number | null {
  const proc = Date.parse(`${procedureDate.trim()}T12:00:00.000Z`);
  const ref = Date.parse(referenceIso);
  if (!Number.isFinite(proc) || !Number.isFinite(ref)) return null;
  const diffMs = ref - proc;
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000));
}

function buildGroupSummaries(
  images: readonly SurgeryImagingIntelligenceImageInput[]
): SurgeryImagingGroupSummary[] {
  const buckets = new Map<
    SurgeryImagingIntelligenceGroup,
    {
      imageIds: string[];
      presentViews: Set<string>;
      usable: number;
      poor: number;
    }
  >();

  for (const group of SURGERY_IMAGING_INTELLIGENCE_GROUPS) {
    buckets.set(group, { imageIds: [], presentViews: new Set(), usable: 0, poor: 0 });
  }

  for (const image of images) {
    const group = classifySurgeryImagingGroup(image);
    if (!group) continue;
    const bucket = buckets.get(group)!;
    bucket.imageIds.push(image.imageId);
    bucket.presentViews.add(resolveCanonicalCategory(image));
    if (isImageUsable(image)) bucket.usable += 1;
    if (isPoorQuality(image)) bucket.poor += 1;
  }

  return SURGERY_IMAGING_INTELLIGENCE_GROUPS.map((group) => {
    const bucket = buckets.get(group)!;
    const required = GROUP_REQUIRED_VIEWS[group];
    const missing = required.filter((view) => {
      const hasView = [...bucket.presentViews].some(
        (present) => present === view || present.includes(view)
      );
      return !hasView || bucket.usable === 0;
    });
    return {
      group,
      image_count: bucket.imageIds.length,
      usable_image_count: bucket.usable,
      poor_quality_count: bucket.poor,
      image_ids: [...bucket.imageIds],
      present_views: [...bucket.presentViews].sort(),
      missing_required_views: missing,
      complete: bucket.usable > 0 && missing.length === 0,
    };
  });
}

function resolveHairAuditLink(
  input: BuildSurgeryImagingIntelligenceSummaryInput
): HairAuditLinkResolution {
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

export function buildSurgeryImagingAuditReadiness(input: {
  groups: readonly SurgeryImagingGroupSummary[];
  hasReviewedGraftCount: boolean;
  hairAuditLink: HairAuditLinkResolution;
  procedureDate?: string | null;
  followUpDueAfterMonths?: number;
  referenceDate?: string;
}): SurgeryImagingAuditReadiness {
  const byGroup = new Map(input.groups.map((g) => [g.group, g]));
  const baseline = byGroup.get("baseline_pre_op");
  const donor = byGroup.get("donor");
  const recipient = byGroup.get("recipient");
  const immediate = byGroup.get("immediate_post_op");
  const followUp = byGroup.get("follow_up");

  const baselinePresent = Boolean(baseline?.complete || (baseline?.usable_image_count ?? 0) > 0);
  const donorComplete = Boolean(donor?.complete);
  const recipientComplete = Boolean(recipient?.complete);
  const immediatePresent = Boolean(immediate?.complete || (immediate?.usable_image_count ?? 0) > 0);

  const followUpCaptured = Boolean(followUp?.usable_image_count && followUp.usable_image_count > 0);
  const dueMonths = input.followUpDueAfterMonths ?? 10;
  const referenceDate = input.referenceDate ?? new Date().toISOString();
  const monthsSince =
    input.procedureDate != null
      ? monthsSinceProcedure(input.procedureDate, referenceDate)
      : null;
  const followUpDue = monthsSince != null && monthsSince >= dueMonths;
  const followUpCapturedOrDue = followUpCaptured || followUpDue;

  const hairAuditResolved = Boolean(
    input.hairAuditLink.hairaudit_case_id && !input.hairAuditLink.linkage_conflict
  );

  const missing: string[] = [];
  if (!baselinePresent) missing.push("baseline_pre_op");
  if (!donorComplete) missing.push("donor_set");
  if (!recipientComplete) missing.push("recipient_set");
  if (!immediatePresent) missing.push("immediate_post_op");
  if (!followUpCapturedOrDue) missing.push("follow_up");
  if (!input.hasReviewedGraftCount) missing.push("reviewed_graft_count");
  if (!hairAuditResolved) {
    if (input.hairAuditLink.linkage_conflict) missing.push("hairaudit_linkage_conflict");
    else missing.push("hairaudit_link");
  }

  const beforeAfterReady =
    baselinePresent && immediatePresent && followUpCapturedOrDue && !input.hairAuditLink.linkage_conflict;

  const graftAndLinkReady =
    input.hasReviewedGraftCount && hairAuditResolved && !input.hairAuditLink.linkage_conflict;

  const overall =
    baselinePresent &&
    donorComplete &&
    recipientComplete &&
    immediatePresent &&
    followUpCapturedOrDue &&
    graftAndLinkReady;

  return {
    baseline_present: baselinePresent,
    donor_set_complete: donorComplete,
    recipient_set_complete: recipientComplete,
    immediate_post_op_present: immediatePresent,
    follow_up_captured_or_due: followUpCapturedOrDue,
    reviewed_graft_count_present: input.hasReviewedGraftCount,
    hairaudit_link_resolved: hairAuditResolved,
    hairaudit_linkage_conflict: input.hairAuditLink.linkage_conflict,
    before_after_ready: beforeAfterReady,
    overall_audit_ready: overall,
    missing_requirements: missing,
  };
}

export function computeSurgeryImagingCompletenessScore(
  groups: readonly SurgeryImagingGroupSummary[]
): number {
  if (!groups.length) return 0;
  const complete = groups.filter((g) => g.complete).length;
  return Math.round((complete / groups.length) * 100);
}

export function buildSurgeryImagingIntelligenceSummary(
  input: BuildSurgeryImagingIntelligenceSummaryInput
): SurgeryImagingIntelligenceSummary {
  const groups = buildGroupSummaries(input.images);
  const poorQualityImageIds = input.images
    .filter((image) => isPoorQuality(image))
    .map((image) => image.imageId);
  const missingRequiredViews = [
    ...new Set(groups.flatMap((group) => group.missing_required_views)),
  ].sort();

  const hairAuditLink = resolveHairAuditLink(input);
  const auditReadiness = buildSurgeryImagingAuditReadiness({
    groups,
    hasReviewedGraftCount: input.hasReviewedGraftCount,
    hairAuditLink,
    procedureDate: input.procedureDate ?? null,
    followUpDueAfterMonths: input.followUpDueAfterMonths,
    referenceDate: input.referenceDate,
  });

  return {
    groups,
    missing_required_views: missingRequiredViews,
    poor_quality_image_ids: poorQualityImageIds,
    audit_readiness: auditReadiness,
    completeness_score: computeSurgeryImagingCompletenessScore(groups),
    hairaudit_case_id: hairAuditLink.hairaudit_case_id,
    hairaudit_link_origin: hairAuditLink.link_origin,
  };
}

export function toSurgeryImagingIntelligenceSummaryFacts(
  summary: SurgeryImagingIntelligenceSummary | null
): SurgeryImagingIntelligenceSummaryFacts | null {
  if (!summary) return null;
  return {
    groups: summary.groups,
    missing_required_views: summary.missing_required_views,
    poor_quality_image_ids: summary.poor_quality_image_ids,
    audit_readiness: summary.audit_readiness,
    completeness_score: summary.completeness_score,
    hairaudit_case_id: summary.hairaudit_case_id,
    hairaudit_link_origin: summary.hairaudit_link_origin,
  };
}

export function formatSurgeryImagingCompletenessLabel(score: number): string {
  if (score >= 100) return "Complete";
  if (score >= 67) return "Strong";
  if (score >= 34) return "Partial";
  if (score > 0) return "Gaps";
  return "Not started";
}

export function formatSurgeryImagingAuditReadinessLabel(
  readiness: Pick<SurgeryImagingAuditReadiness, "overall_audit_ready" | "hairaudit_linkage_conflict" | "before_after_ready">
): string {
  if (readiness.hairaudit_linkage_conflict) return "Conflict — review";
  if (readiness.overall_audit_ready) return "Audit ready";
  if (readiness.before_after_ready) return "Before/after ready";
  return "Building";
}

/** Map fi_patient_images row fields into surgery imaging intelligence input (pure). */
export function mapPatientImageRowToSurgeryImagingInput(row: {
  id: string;
  image_category?: string | null;
  anatomical_region?: string | null;
  visit_type?: string | null;
  follow_up_interval?: string | null;
  metadata?: Record<string, unknown> | null;
}): SurgeryImagingIntelligenceImageInput {
  const metadata = row.metadata ?? {};
  const imagingQuality =
    metadata.imaging_quality && typeof metadata.imaging_quality === "object"
      ? (metadata.imaging_quality as Record<string, unknown>)
      : null;

  return {
    imageId: row.id,
    canonicalCategory:
      readString(metadata.canonical_view) ??
      readString(metadata.canonical_category) ??
      readString(row.anatomical_region),
    surgicalEvent:
      readString(metadata.surgical_event) ?? readString(metadata.procedure_stage),
    procedureStage: readString(metadata.procedure_stage),
    captureSource:
      readString(metadata.capture_source) ?? readString(metadata.upload_source),
    imageCategory: row.image_category ?? null,
    anatomicalRegion: row.anatomical_region ?? null,
    visitType: row.visit_type ?? readString(metadata.visit_type),
    followUpInterval: row.follow_up_interval ?? readString(metadata.follow_up_interval),
    qualityStatus:
      readString(imagingQuality?.quality_status) ?? readString(metadata.classifier_status),
    isClinicallyUsable:
      typeof metadata.is_clinically_usable === "boolean"
        ? metadata.is_clinically_usable
        : null,
    capturedAt: readString(metadata.captured_at),
  };
}

export { deriveHairAuditAuditReadiness };