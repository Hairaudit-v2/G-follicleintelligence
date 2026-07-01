import type { PatientJourneyState } from "@/src/lib/patientJourney/patientJourneyStateCore";

export type CalendarAppointmentRiskStatus = "ready" | "attention" | "at_risk" | "blocked";

export type CalendarOperationalBlockerKind =
  | "missing_staff"
  | "missing_room"
  | "unpaid_deposit"
  | "missing_consent"
  | "incomplete_pre_op"
  | "outside_clinic_hours"
  | "room_conflict"
  | "surgeon_conflict"
  | "staff_conflict"
  | "patient_conflict"
  | "surgery_without_staff";

export type CalendarOperationalBlocker = {
  kind: CalendarOperationalBlockerKind;
  label: string;
  severity: "info" | "warning" | "critical";
  href: string | null;
};

export type CalendarConflictKind =
  | "room_overlap"
  | "surgeon_overlap"
  | "staff_overlap"
  | "patient_overlap"
  | "outside_clinic_hours"
  | "surgery_without_required_staff";

export type CalendarConflictViolation = {
  kind: CalendarConflictKind;
  severity: "warning" | "error";
  message: string;
  conflictingBookingId: string | null;
};

export type CalendarBookingIntelligenceInput = {
  bookingId: string;
  tenantId: string;
  bookingType: string;
  bookingStatus: string;
  startAt: string;
  endAt: string;
  patientId: string | null;
  caseId: string | null;
  clinicId: string | null;
  roomId: string | null;
  roomRequired: boolean;
  assignedStaffId: string | null;
  assignedUserId: string | null;
  metadata: Record<string, unknown>;
  /** Pre-op checklist complete when all required flags true. */
  preOpChecklistComplete?: boolean;
  consentSigned?: boolean;
  depositSatisfied?: boolean;
  paymentTracked?: boolean;
  journeyState?: PatientJourneyState | null;
  staffSummary?: string | null;
  roomLabel?: string | null;
  graftEstimate?: string | null;
  /** 0–100 when surgery/case readiness known. */
  readinessPercent?: number | null;
};

export type CalendarBookingIntelligence = {
  riskStatus: CalendarAppointmentRiskStatus;
  readinessPercent: number | null;
  readinessReady: boolean;
  journeyState: PatientJourneyState | null;
  journeyStateLabel: string | null;
  paymentFlag: "unknown" | "due" | "satisfied" | "not_required";
  consentFlag: "unknown" | "missing" | "signed";
  blockers: CalendarOperationalBlocker[];
  blockerCount: number;
  nextAction: { label: string; href: string | null } | null;
  isSurgery: boolean;
};

export type CalendarOperationalFeedItem = {
  id: string;
  patientDisplayName: string;
  appointmentType: string;
  startAt: string;
  endAt: string;
  status: string;
  clinicianSummary: string | null;
  room: string | null;
  paymentFlag: CalendarBookingIntelligence["paymentFlag"];
  readinessReady: boolean;
  readinessPercent: number | null;
  journeyState: PatientJourneyState | null;
  journeyStateLabel: string | null;
  blockerCount: number;
  riskStatus: CalendarAppointmentRiskStatus;
  isSurgery: boolean;
  graftEstimate: string | null;
};

/** Keys allowed in serialized calendar operational feed payloads (perf regression guard). */
export const CALENDAR_OPERATIONAL_FEED_ITEM_KEYS = [
  "id",
  "patientDisplayName",
  "appointmentType",
  "startAt",
  "endAt",
  "status",
  "clinicianSummary",
  "room",
  "paymentFlag",
  "readinessReady",
  "readinessPercent",
  "journeyState",
  "journeyStateLabel",
  "blockerCount",
  "riskStatus",
  "isSurgery",
  "graftEstimate",
] as const;

/** Heavy fields that must never appear in calendar operational feed payloads. */
export const CALENDAR_OPERATIONAL_FEED_FORBIDDEN_KEYS = [
  "avatar_url",
  "signed_url",
  "signedUrl",
  "transcript",
  "timeline",
  "metadata",
  "description",
  "patientEmail",
  "patientPhone",
  "scalesSummary",
  "clinicalStaffing",
  "reminderJobs",
  "consultation",
  "image_url",
] as const;