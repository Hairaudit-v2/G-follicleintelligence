import { z } from "zod";

/** Lightweight encounter types — no full consultation required. */
export const FOLLOW_UP_ENCOUNTER_TYPES = [
  "follow_up",
  "legacy_follow_up",
  "photos_only",
  "treatment_review",
  "post_op_review",
  "donor_review",
  "concern_review",
] as const;

export type FollowUpEncounterType = (typeof FOLLOW_UP_ENCOUNTER_TYPES)[number];

export const FOLLOW_UP_ENCOUNTER_STATUSES = ["draft", "completed"] as const;
export type FollowUpEncounterStatus = (typeof FOLLOW_UP_ENCOUNTER_STATUSES)[number];

export const LEGACY_PATIENT_SOURCES = ["timely"] as const;
export type LegacyPatientSource = (typeof LEGACY_PATIENT_SOURCES)[number];

/** AI pipeline status on imaging protocol sessions. */
export const IMAGING_SESSION_AI_STATUSES = [
  "pending",
  "processing",
  "completed",
  "needs_review",
  "failed",
] as const;
export type ImagingSessionAiStatus = (typeof IMAGING_SESSION_AI_STATUSES)[number];

/** Clinician governance for AI imaging summaries — advisory only until approved. */
export const IMAGING_SESSION_AI_REVIEW_STATUSES = [
  "ai_pending",
  "ai_ready_for_review",
  "clinician_approved",
  "clinician_rejected",
] as const;
export type ImagingSessionAiReviewStatus = (typeof IMAGING_SESSION_AI_REVIEW_STATUSES)[number];

export const IMAGING_SESSION_COMPLETENESS_STATUSES = [
  "incomplete",
  "partial",
  "complete",
  "needs_retake",
] as const;
export type ImagingSessionCompletenessStatus =
  (typeof IMAGING_SESSION_COMPLETENESS_STATUSES)[number];

/** Clinical view classification for follow-up imaging (extends HLI categories). */
export const FOLLOW_UP_IMAGE_VIEW_TYPES = [
  "front",
  "left",
  "right",
  "crown",
  "top",
  "donor",
  "donor_closeup",
  "recipient_closeup",
  "immediate_post_op",
  "follow_up",
  "graft_tray",
  "microscopic",
  "other",
] as const;
export type FollowUpImageViewType = (typeof FOLLOW_UP_IMAGE_VIEW_TYPES)[number];

export type FollowUpEncounterRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  clinic_id: string | null;
  staff_id: string | null;
  booking_id: string | null;
  encounter_type: FollowUpEncounterType;
  legacy_source: LegacyPatientSource | null;
  legacy_external_id: string | null;
  visit_reason: string | null;
  clinical_note: string | null;
  treatment_update: string | null;
  follow_up_plan: string | null;
  status: FollowUpEncounterStatus;
  created_by: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FollowUpEncounterImagingSessionRow = {
  id: string;
  template_slug: string;
  session_completeness_status: ImagingSessionCompletenessStatus | null;
  ai_status: ImagingSessionAiStatus | null;
  ai_review_status: ImagingSessionAiReviewStatus | null;
  created_at: string;
};

export const createLegacyReturningPatientBodySchema = z
  .object({
    adminKey: z.string().optional(),
    firstName: z.string().min(1).max(120),
    lastName: z.string().min(1).max(120),
    mobile: z.string().min(6).max(40),
    email: z.string().email(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    legacySource: z.enum(LEGACY_PATIENT_SOURCES).default("timely"),
    legacyExternalId: z.string().max(200).optional(),
    legacyPatientReference: z.string().max(200).optional(),
  })
  .strict();

export const createFollowUpEncounterBodySchema = z
  .object({
    adminKey: z.string().optional(),
    patientId: z.string().uuid(),
    encounterType: z.enum(FOLLOW_UP_ENCOUNTER_TYPES),
    legacySource: z.enum(LEGACY_PATIENT_SOURCES).optional(),
    legacyExternalId: z.string().max(200).optional(),
    visitReason: z.string().max(2000).optional(),
    clinicalNote: z.string().max(8000).optional(),
    treatmentUpdate: z.string().max(4000).optional(),
    followUpPlan: z.string().max(4000).optional(),
    clinicId: z.string().uuid().optional(),
    staffId: z.string().uuid().optional(),
    bookingId: z.string().uuid().optional(),
    status: z.enum(FOLLOW_UP_ENCOUNTER_STATUSES).default("draft"),
  })
  .strict();

export const updateFollowUpEncounterAiReviewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    sessionId: z.string().uuid(),
    reviewStatus: z.enum(["clinician_approved", "clinician_rejected"]),
    clinicianNote: z.string().max(4000).optional(),
  })
  .strict();

/** Human-readable labels for UI copy. */
export const FOLLOW_UP_ENCOUNTER_TYPE_LABELS: Record<FollowUpEncounterType, string> = {
  follow_up: "Follow-up visit",
  legacy_follow_up: "Legacy follow-up (Timely)",
  photos_only: "Photos only",
  treatment_review: "Treatment review",
  post_op_review: "Post-op review",
  donor_review: "Donor area review",
  concern_review: "Concern review",
};

export function followUpEncounterTimelineTitle(
  encounterType: FollowUpEncounterType,
  legacySource: LegacyPatientSource | null
): string {
  if (encounterType === "legacy_follow_up" || legacySource === "timely") {
    return "Legacy follow-up";
  }
  if (encounterType === "photos_only") return "Photos captured";
  return FOLLOW_UP_ENCOUNTER_TYPE_LABELS[encounterType] ?? "Follow-up";
}

/** AI summaries are advisory; never expose to patients until clinician approved. */
export function isAiImagingSummaryPatientVisible(
  reviewStatus: ImagingSessionAiReviewStatus | null | undefined
): boolean {
  return reviewStatus === "clinician_approved";
}

export function imagingAiReviewStatusLabel(
  status: ImagingSessionAiReviewStatus | null | undefined
): string {
  switch (status) {
    case "ai_pending":
      return "AI imaging review pending";
    case "ai_ready_for_review":
      return "AI imaging review pending clinician approval";
    case "clinician_approved":
      return "AI imaging summary approved";
    case "clinician_rejected":
      return "AI imaging summary rejected";
    default:
      return "AI imaging review pending";
  }
}
