/**
 * Enhanced Patient Timeline + Visual Journey — operational view types only.
 */

export const PATIENT_JOURNEY_DISCLAIMER =
  "This journey shows recorded operational data only (photos, bookings, scale fields on file). Always verify clinically — it does not diagnose or recommend treatment.";

export type PatientJourneyPhotoLabel =
  | "baseline"
  | "progress"
  | "post_op"
  | "consult"
  | "donor"
  | "hairline"
  | "other";

export type PatientJourneyPhotoItem = {
  id: string;
  takenAtIso: string | null;
  createdAtIso: string;
  label: PatientJourneyPhotoLabel;
  labelDisplay: string;
  categoryRaw: string;
  caption: string | null;
  /** Signed URL when available (short TTL). */
  thumbUrl: string | null;
  href: string;
};

export type PatientJourneyScaleKind =
  | "norwood"
  | "ludwig"
  | "sgfhc"
  | "green"
  | "adfhl"
  | "hairline"
  | "other";

export type PatientJourneyScalePoint = {
  kind: PatientJourneyScaleKind;
  kindLabel: string;
  value: string;
  recordedAtIso: string | null;
  source: "clinical_details" | "metadata_history" | "flag";
};

export type PatientJourneyScaleSeries = {
  kind: PatientJourneyScaleKind;
  kindLabel: string;
  points: readonly PatientJourneyScalePoint[];
  /** "up" | "down" | "stable" | "single" — display only, not clinical interpretation. */
  trend: "up" | "down" | "stable" | "single" | "unknown";
  trendLabel: string;
};

export type PatientJourneyMilestoneKind =
  | "consult"
  | "procedure"
  | "deposit"
  | "follow_up"
  | "imaging"
  | "case"
  | "lead"
  | "record"
  | "other";

export type PatientJourneyMilestone = {
  id: string;
  kind: PatientJourneyMilestoneKind;
  kindLabel: string;
  title: string;
  subtitle: string | null;
  occurredAtIso: string;
  href: string | null;
  severity: "info" | "attention" | "success";
};

export type PatientJourneyQuickAction = {
  code: string;
  label: string;
  description: string;
  href: string;
};

export type PatientJourneyAiCompact = {
  available: boolean;
  overview: string | null;
  flagCount: number;
  source: string | null;
};

export type PatientJourneyView = {
  tenantId: string;
  patientId: string;
  displayName: string | null;
  disclaimer: string;
  photos: readonly PatientJourneyPhotoItem[];
  scaleSeries: readonly PatientJourneyScaleSeries[];
  milestones: readonly PatientJourneyMilestone[];
  quickActions: readonly PatientJourneyQuickAction[];
  stats: {
    photoCount: number;
    milestoneCount: number;
    scaleKindsRecorded: number;
    upcomingBookings: number;
  };
};
