/**
 * Pure legacy / returning Timely patient visibility (FI-LEGACY-PATIENTOS-FILTER-1).
 */

import {
  deriveBookingContinuityStatus,
  type BookingContinuityImagingSessionInput,
} from "@/src/lib/followUpEncounters/bookingFollowUpContextCore";
import {
  canReadFollowUpClinicalPhi,
  normalizeFollowUpRole,
  type FollowUpEncounterPermissionRole,
} from "@/src/lib/followUpEncounters/followUpEncounterPermissions";
import type { LegacyPatientSource } from "@/src/lib/followUpEncounters/followUpEncounterTypes";
import { isAiImagingSummaryPatientVisible } from "@/src/lib/followUpEncounters/followUpEncounterTypes";
import { buildFollowUpImagingCaptureHref } from "@/src/lib/followUpEncounters/followUpImagingRoutes";
import { buildReturningPatientFlowHref } from "@/src/lib/followUpEncounters/followUpImagingRoutes";

export const LEGACY_MERGE_READINESS_STATUSES = [
  "no_duplicate_suspected",
  "possible_duplicate",
  "timely_source_linked",
  "needs_manual_merge_review",
  "historical_import_pending",
] as const;

export type LegacyMergeReadinessStatus = (typeof LEGACY_MERGE_READINESS_STATUSES)[number];

export const LEGACY_PATIENT_BADGE_KINDS = [
  "timely",
  "legacy",
  "follow_up_active",
  "photos_captured",
  "ai_review_pending",
  "clinician_approved",
  "record_incomplete",
  "merge_review",
] as const;

export type LegacyPatientBadgeKind = (typeof LEGACY_PATIENT_BADGE_KINDS)[number];

export type LegacyPatientBadge = {
  kind: LegacyPatientBadgeKind;
  label: string;
};

export type LegacyPatientBannerKind =
  | "returning_timely"
  | "historical_incomplete"
  | "continue_care"
  | "ai_review_pending"
  | "merge_review";

export type LegacyPatientProfileBanner = {
  kind: LegacyPatientBannerKind;
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
  secondaryHref?: string;
  secondaryHrefLabel?: string;
};

export type LegacyPatientVisibilityDisplayPolicy = {
  showOperationalBadges: boolean;
  showAiReviewPendingBadge: boolean;
  showClinicianApprovedBadge: boolean;
  /** Unapproved AI summary text — clinical roles only. */
  showAiSummaryText: boolean;
  showClinicalNoteText: boolean;
};

export type LegacyFollowUpEncounterSnapshot = {
  id: string;
  encounter_type: string;
  legacy_source: string | null;
  status: string;
  booking_id?: string | null;
  created_at: string;
  completed_at: string | null;
};

export type LegacyFollowUpImagingSessionSnapshot = {
  id: string;
  follow_up_encounter_id: string | null;
  session_completeness_status: string | null;
  ai_status: string | null;
  ai_review_status: string | null;
  created_at: string;
};

export type LegacyPatientSourceMapping = {
  source_system: string;
  source_patient_id: string;
};

export type LegacyPatientVisibilityInput = {
  patientId: string;
  patientMetadata: Record<string, unknown>;
  sourceMappings: readonly LegacyPatientSourceMapping[];
  encounters: readonly LegacyFollowUpEncounterSnapshot[];
  imagingSessions: readonly LegacyFollowUpImagingSessionSnapshot[];
  followUpImageCount?: number;
  latestBookingId?: string | null;
};

export type LegacyPatientVisibilitySummary = {
  patientId: string;
  legacy_source: LegacyPatientSource | string | null;
  legacy_external_id: string | null;
  returning_from_timely: boolean;
  has_legacy_source: boolean;
  historical_record_incomplete: boolean;
  has_follow_up_encounter: boolean;
  follow_up_encounter_count: number;
  follow_up_imaging_session_count: number;
  latest_follow_up_at: string | null;
  latest_follow_up_type: string | null;
  latest_follow_up_encounter_id: string | null;
  latest_follow_up_imaging_session_id: string | null;
  latest_ai_review_status: string | null;
  latest_ai_status: string | null;
  has_unapproved_ai_summary: boolean;
  has_photos_captured: boolean;
  has_photos_without_ai_approval: boolean;
  has_ai_review_pending: boolean;
  has_clinician_approved_ai_review: boolean;
  needs_merge_review: boolean;
  merge_readiness: LegacyMergeReadinessStatus;
  latest_booking_id: string | null;
  continuity_status: ReturnType<typeof deriveBookingContinuityStatus>;
};

function readMetadataString(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function readMetadataBool(meta: Record<string, unknown>, key: string): boolean {
  const v = meta[key];
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  return false;
}

export function parseLegacySourceFromPatient(
  metadata: Record<string, unknown>,
  sourceMappings: readonly LegacyPatientSourceMapping[]
): string | null {
  const fromMeta = readMetadataString(metadata, "legacy_source");
  if (fromMeta) return fromMeta;
  const timely = sourceMappings.find((m) => m.source_system.trim().toLowerCase() === "timely");
  if (timely) return "timely";
  const first = sourceMappings[0];
  return first?.source_system?.trim() ?? null;
}

export function parseLegacyExternalId(
  metadata: Record<string, unknown>,
  sourceMappings: readonly LegacyPatientSourceMapping[],
  legacySource: string | null
): string | null {
  const fromMeta = readMetadataString(metadata, "legacy_external_id");
  if (fromMeta) return fromMeta;
  if (!legacySource) return null;
  const match = sourceMappings.find(
    (m) => m.source_system.trim().toLowerCase() === legacySource.trim().toLowerCase()
  );
  return match?.source_patient_id?.trim() ?? null;
}

export function isReturningFromTimely(
  metadata: Record<string, unknown>,
  sourceMappings: readonly LegacyPatientSourceMapping[]
): boolean {
  if (parseLegacySourceFromPatient(metadata, sourceMappings) === "timely") return true;
  return sourceMappings.some((m) => m.source_system.trim().toLowerCase() === "timely");
}

export function isHistoricalRecordIncomplete(metadata: Record<string, unknown>): boolean {
  if (!readMetadataBool(metadata, "returning_patient")) return false;
  const note = readMetadataString(metadata, "historical_record_note");
  return Boolean(note && /not fully imported/i.test(note));
}

export function sessionHasPhotos(session: LegacyFollowUpImagingSessionSnapshot): boolean {
  const c = session.session_completeness_status?.trim().toLowerCase();
  return c === "partial" || c === "complete";
}

export function sessionAiReviewPending(session: LegacyFollowUpImagingSessionSnapshot): boolean {
  const s = session.ai_review_status?.trim().toLowerCase();
  return s === "ai_pending" || s === "ai_ready_for_review";
}

export function deriveMergeReadinessStatus(input: {
  metadata: Record<string, unknown>;
  legacySource: string | null;
  hasTimelyMapping: boolean;
}): LegacyMergeReadinessStatus {
  const meta = input.metadata;
  const mergeStatus = readMetadataString(meta, "merge_review_status")?.toLowerCase();
  if (
    readMetadataBool(meta, "needs_merge_review") ||
    readMetadataBool(meta, "merge_review_needed") ||
    mergeStatus === "needs_manual_merge_review"
  ) {
    return "needs_manual_merge_review";
  }
  if (readMetadataBool(meta, "possible_duplicate_suspected") || mergeStatus === "possible_duplicate") {
    return "possible_duplicate";
  }
  if (isHistoricalRecordIncomplete(meta)) {
    return "historical_import_pending";
  }
  if (input.hasTimelyMapping || input.legacySource === "timely") {
    return "timely_source_linked";
  }
  return "no_duplicate_suspected";
}

export function deriveLegacyPatientVisibilitySummary(
  input: LegacyPatientVisibilityInput
): LegacyPatientVisibilitySummary {
  const meta = input.patientMetadata;
  const legacySource = parseLegacySourceFromPatient(meta, input.sourceMappings);
  const legacyExternalId = parseLegacyExternalId(meta, input.sourceMappings, legacySource);
  const returningFromTimely = isReturningFromTimely(meta, input.sourceMappings);
  const hasLegacySource = Boolean(
    legacySource || readMetadataBool(meta, "returning_patient") || input.sourceMappings.length > 0
  );
  const historicalIncomplete = isHistoricalRecordIncomplete(meta);
  const encounters = [...input.encounters].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  );
  const sessions = [...input.imagingSessions].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  );
  const latestEncounter = encounters[0] ?? null;
  const latestSession = sessions[0] ?? null;
  const followUpImageCount = input.followUpImageCount ?? 0;
  const hasPhotosCaptured =
    followUpImageCount > 0 || sessions.some(sessionHasPhotos);
  const hasAiReviewPending = sessions.some(sessionAiReviewPending);
  const hasClinicianApproved = sessions.some(
    (s) => s.ai_review_status?.trim().toLowerCase() === "clinician_approved"
  );
  const hasPhotosWithoutAiApproval = hasPhotosCaptured && !hasClinicianApproved;
  const hasUnapprovedAiSummary = sessions.some(
    (s) => !isAiImagingSummaryPatientVisible(s.ai_review_status as never)
  );
  const hasTimelyMapping = input.sourceMappings.some(
    (m) => m.source_system.trim().toLowerCase() === "timely"
  );
  const mergeReadiness = deriveMergeReadinessStatus({
    metadata: meta,
    legacySource,
    hasTimelyMapping,
  });
  const needsMergeReview =
    mergeReadiness === "possible_duplicate" || mergeReadiness === "needs_manual_merge_review";

  const continuitySessions: BookingContinuityImagingSessionInput[] = sessions.map((s) => ({
    ai_review_status: s.ai_review_status,
    session_completeness_status: s.session_completeness_status,
  }));

  const continuityStatus = deriveBookingContinuityStatus({
    patientId: input.patientId,
    patientLegacySource: legacySource,
    encounters: encounters.map((e) => ({ id: e.id, status: e.status })),
    imagingSessions: continuitySessions,
    followUpImageCount,
  });

  const latestBookingId =
    input.latestBookingId?.trim() ||
    latestEncounter?.booking_id?.trim() ||
    null;

  return {
    patientId: input.patientId,
    legacy_source: legacySource,
    legacy_external_id: legacyExternalId,
    returning_from_timely: returningFromTimely,
    has_legacy_source: hasLegacySource,
    historical_record_incomplete: historicalIncomplete,
    has_follow_up_encounter: encounters.length > 0,
    follow_up_encounter_count: encounters.length,
    follow_up_imaging_session_count: sessions.length,
    latest_follow_up_at: latestEncounter?.created_at ?? null,
    latest_follow_up_type: latestEncounter?.encounter_type ?? null,
    latest_follow_up_encounter_id: latestEncounter?.id ?? null,
    latest_follow_up_imaging_session_id: latestSession?.id ?? null,
    latest_ai_review_status: latestSession?.ai_review_status ?? null,
    latest_ai_status: latestSession?.ai_status ?? null,
    has_unapproved_ai_summary: hasUnapprovedAiSummary,
    has_photos_captured: hasPhotosCaptured,
    has_photos_without_ai_approval: hasPhotosWithoutAiApproval,
    has_ai_review_pending: hasAiReviewPending,
    has_clinician_approved_ai_review: hasClinicianApproved,
    needs_merge_review: needsMergeReview,
    merge_readiness: mergeReadiness,
    latest_booking_id: latestBookingId,
    continuity_status: continuityStatus,
  };
}

export function deriveLegacyPatientDisplayPolicy(
  role: string | null | undefined
): LegacyPatientVisibilityDisplayPolicy {
  const normalized = normalizeFollowUpRole(role);
  const clinical = canReadFollowUpClinicalPhi(normalized);
  return {
    showOperationalBadges: true,
    showAiReviewPendingBadge: true,
    showClinicianApprovedBadge: true,
    showAiSummaryText: clinical,
    showClinicalNoteText: clinical,
  };
}

const BADGE_LABELS: Record<LegacyPatientBadgeKind, string> = {
  timely: "Timely",
  legacy: "Legacy",
  follow_up_active: "Follow-up active",
  photos_captured: "Photos captured",
  ai_review_pending: "AI review pending",
  clinician_approved: "Clinician approved",
  record_incomplete: "Record incomplete",
  merge_review: "Merge review",
};

export function deriveLegacyPatientBadges(
  summary: LegacyPatientVisibilitySummary,
  policy: LegacyPatientVisibilityDisplayPolicy = deriveLegacyPatientDisplayPolicy("reception")
): LegacyPatientBadge[] {
  if (!policy.showOperationalBadges) return [];
  const badges: LegacyPatientBadge[] = [];
  if (summary.returning_from_timely) {
    badges.push({ kind: "timely", label: BADGE_LABELS.timely });
  } else if (summary.has_legacy_source) {
    badges.push({ kind: "legacy", label: BADGE_LABELS.legacy });
  }
  if (summary.has_follow_up_encounter) {
    badges.push({ kind: "follow_up_active", label: BADGE_LABELS.follow_up_active });
  }
  if (summary.historical_record_incomplete) {
    badges.push({ kind: "record_incomplete", label: BADGE_LABELS.record_incomplete });
  }
  if (summary.needs_merge_review) {
    badges.push({ kind: "merge_review", label: BADGE_LABELS.merge_review });
  }
  if (summary.has_photos_captured) {
    badges.push({ kind: "photos_captured", label: BADGE_LABELS.photos_captured });
  }
  if (policy.showAiReviewPendingBadge && summary.has_ai_review_pending) {
    badges.push({ kind: "ai_review_pending", label: BADGE_LABELS.ai_review_pending });
  }
  if (policy.showClinicianApprovedBadge && summary.has_clinician_approved_ai_review) {
    badges.push({ kind: "clinician_approved", label: BADGE_LABELS.clinician_approved });
  }
  return badges;
}

export function deriveLegacyPatientProfileBanners(
  summary: LegacyPatientVisibilitySummary,
  tenantId: string,
  policy: LegacyPatientVisibilityDisplayPolicy = deriveLegacyPatientDisplayPolicy("reception")
): LegacyPatientProfileBanner[] {
  const banners: LegacyPatientProfileBanner[] = [];
  const followUpHref = buildReturningPatientFlowHref(tenantId, {
    patientId: summary.patientId,
    intent: "follow_up",
  });
  const captureHref =
    summary.latest_follow_up_encounter_id && summary.latest_follow_up_imaging_session_id
      ? buildFollowUpImagingCaptureHref(
          tenantId,
          summary.patientId,
          summary.latest_follow_up_encounter_id,
          summary.latest_follow_up_imaging_session_id,
          summary.latest_booking_id ? { bookingId: summary.latest_booking_id } : undefined
        )
      : buildReturningPatientFlowHref(tenantId, {
          patientId: summary.patientId,
          intent: "photos",
        });

  if (summary.returning_from_timely) {
    banners.push({
      kind: "returning_timely",
      title: "Returning patient from Timely",
      description: "Continue care from today's FI OS record. The historical Timely chart stays outside FI OS.",
      href: followUpHref,
      hrefLabel: "Add today's follow-up",
      secondaryHref: captureHref,
      secondaryHrefLabel: "Capture photos",
    });
  } else if (summary.has_legacy_source) {
    banners.push({
      kind: "continue_care",
      title: "Continue care in FI OS",
      description: "This patient has a linked legacy source. Add today's follow-up without a full consultation.",
      href: followUpHref,
      hrefLabel: "Add today's follow-up",
      secondaryHref: captureHref,
      secondaryHrefLabel: "Capture photos",
    });
  }

  if (summary.historical_record_incomplete) {
    banners.push({
      kind: "historical_incomplete",
      title: "Historical record not fully imported yet",
      description: "Use FI OS for today's visit. Prior Timely history remains reference-only until import.",
    });
  }

  if (summary.has_ai_review_pending) {
    banners.push({
      kind: "ai_review_pending",
      title: "AI imaging review pending clinician approval",
      description: policy.showAiSummaryText
        ? "Review the AI imaging summary before sharing with the patient."
        : "A clinician must approve the AI imaging summary before it is shared with the patient.",
    });
  }

  if (summary.needs_merge_review) {
    banners.push({
      kind: "merge_review",
      title: "Possible duplicate or merge review needed",
      description:
        "Do not merge automatically. Confirm identity with reception or clinical admin before linking records.",
    });
  }

  return banners;
}

export type LegacyPatientDirectoryFilterKey =
  | "returningFromTimely"
  | "hasLegacySource"
  | "historicalIncomplete"
  | "hasFollowUpEncounter"
  | "hasPhotosCaptured"
  | "aiReviewPending"
  | "clinicianApprovedAi"
  | "needsMergeReview"
  | "photosNoAiApproval";

export type LegacyPatientDirectoryFilters = Partial<
  Record<LegacyPatientDirectoryFilterKey, boolean>
> & {
  /** ISO timestamp — follow-up encounter created_at must be >= this (saved view: this week). */
  followUpSince?: string | null;
};

export function matchesLegacyPatientDirectoryFilters(
  summary: LegacyPatientVisibilitySummary,
  filters: LegacyPatientDirectoryFilters,
  opts?: { followUpEncounterDates?: readonly string[] }
): boolean {
  if (filters.returningFromTimely && !summary.returning_from_timely) return false;
  if (filters.hasLegacySource && !summary.has_legacy_source) return false;
  if (filters.historicalIncomplete && !summary.historical_record_incomplete) return false;
  if (filters.hasFollowUpEncounter && !summary.has_follow_up_encounter) return false;
  if (filters.hasPhotosCaptured && !summary.has_photos_captured) return false;
  if (filters.aiReviewPending && !summary.has_ai_review_pending) return false;
  if (filters.clinicianApprovedAi && !summary.has_clinician_approved_ai_review) return false;
  if (filters.needsMergeReview && !summary.needs_merge_review) return false;
  if (filters.photosNoAiApproval && !summary.has_photos_without_ai_approval) return false;

  if (filters.followUpSince) {
    const sinceMs = Date.parse(filters.followUpSince);
    const dates = opts?.followUpEncounterDates ?? [];
    if (!dates.some((d) => Date.parse(d) >= sinceMs)) return false;
  }

  return true;
}

export function legacyDirectoryFiltersAreActive(filters: LegacyPatientDirectoryFilters): boolean {
  return Boolean(
    filters.returningFromTimely ||
      filters.hasLegacySource ||
      filters.historicalIncomplete ||
      filters.hasFollowUpEncounter ||
      filters.hasPhotosCaptured ||
      filters.aiReviewPending ||
      filters.clinicianApprovedAi ||
      filters.needsMergeReview ||
      filters.photosNoAiApproval ||
      filters.followUpSince
  );
}

export function mergeReadinessLabel(status: LegacyMergeReadinessStatus): string {
  switch (status) {
    case "no_duplicate_suspected":
      return "No duplicate suspected";
    case "possible_duplicate":
      return "Possible duplicate";
    case "timely_source_linked":
      return "Timely source linked";
    case "needs_manual_merge_review":
      return "Merge review needed";
    case "historical_import_pending":
      return "Historical import pending";
    default:
      return status;
  }
}

/** Reception-safe row view — never includes AI summary text. */
export function toPermissionSafeLegacyRowView(
  summary: LegacyPatientVisibilitySummary,
  role: FollowUpEncounterPermissionRole | string | null | undefined
): {
  summary: LegacyPatientVisibilitySummary;
  badges: LegacyPatientBadge[];
  mergeLabel: string;
  aiSummaryText: null;
} {
  const policy = deriveLegacyPatientDisplayPolicy(role);
  return {
    summary,
    badges: deriveLegacyPatientBadges(summary, policy),
    mergeLabel: mergeReadinessLabel(summary.merge_readiness),
    aiSummaryText: null,
  };
}