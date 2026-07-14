/**
 * Pure booking → follow-up encounter context (FI-LEGACY-FOLLOWUP-CALENDAR-ENTRY-1).
 */

import type { FollowUpEncounterType } from "./followUpEncounterTypes";

export const BOOKING_CONTINUITY_STATUSES = [
  "no_fi_patient_linked",
  "legacy_timely_patient",
  "follow_up_started",
  "photos_captured",
  "ai_imaging_review_pending",
  "clinician_approved",
] as const;

export type BookingContinuityStatus = (typeof BOOKING_CONTINUITY_STATUSES)[number];

export const BOOKING_CONTINUITY_LABELS: Record<BookingContinuityStatus, string> = {
  no_fi_patient_linked: "No FI patient linked",
  legacy_timely_patient: "Legacy Timely patient",
  follow_up_started: "Follow-up started",
  photos_captured: "Photos captured",
  ai_imaging_review_pending: "AI imaging review pending",
  clinician_approved: "Clinician approved",
};

export type BookingContinuityImagingSessionInput = {
  ai_review_status: string | null;
  session_completeness_status: string | null;
};

export type BookingContinuityEncounterInput = {
  id: string;
  status: string;
};

export type DeriveBookingContinuityInput = {
  patientId: string | null;
  patientLegacySource: string | null;
  encounters: readonly BookingContinuityEncounterInput[];
  imagingSessions: readonly BookingContinuityImagingSessionInput[];
  followUpImageCount?: number;
};

export function deriveBookingContinuityStatus(
  input: DeriveBookingContinuityInput
): BookingContinuityStatus | null {
  const sessions = input.imagingSessions;
  if (sessions.some((s) => s.ai_review_status === "clinician_approved")) {
    return "clinician_approved";
  }
  if (
    sessions.some(
      (s) => s.ai_review_status === "ai_pending" || s.ai_review_status === "ai_ready_for_review"
    )
  ) {
    return "ai_imaging_review_pending";
  }
  const hasPhotos =
    (input.followUpImageCount ?? 0) > 0 ||
    sessions.some((s) => {
      const c = s.session_completeness_status?.trim().toLowerCase();
      return c === "partial" || c === "complete";
    });
  if (hasPhotos) return "photos_captured";
  if (input.encounters.length > 0) return "follow_up_started";
  if (input.patientId && input.patientLegacySource === "timely") return "legacy_timely_patient";
  if (!input.patientId) return "no_fi_patient_linked";
  return null;
}

export function bookingContinuityLabel(status: BookingContinuityStatus | null): string | null {
  if (!status) return null;
  return BOOKING_CONTINUITY_LABELS[status];
}

/** Map calendar booking_type to default follow-up encounter type. */
export function encounterTypeForBookingType(bookingType: string): FollowUpEncounterType {
  const t = bookingType.trim().toLowerCase();
  if (t === "photos_only" || t === "photo_session") return "photos_only";
  if (t.includes("post_op") || t === "post_op_review") return "post_op_review";
  if (t.includes("donor")) return "donor_review";
  if (t.includes("prp") || t.includes("exosome") || t.includes("treatment"))
    return "treatment_review";
  if (t.includes("concern") || t.includes("review")) return "concern_review";
  if (t === "follow_up" || t.includes("follow")) return "follow_up";
  return "legacy_follow_up";
}

export function buildVisitReasonFromBooking(input: {
  bookingType: string;
  title: string | null;
  startAt: string;
}): string {
  const typeLabel = input.bookingType.replace(/_/g, " ");
  const title = input.title?.trim();
  let when = "";
  try {
    when = new Date(input.startAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    when = input.startAt.slice(0, 16);
  }
  if (title) return `${title} · ${when}`;
  return `${typeLabel} · ${when}`;
}

export function formatBookingAppointmentWhen(
  startAt: string,
  endAt: string,
  tz?: string | null
): string {
  try {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(tz ? { timeZone: tz } : {}),
    };
    const endOpts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      ...(tz ? { timeZone: tz } : {}),
    };
    return `${start.toLocaleString(undefined, opts)} – ${end.toLocaleString(undefined, endOpts)}`;
  } catch {
    return `${startAt} – ${endAt}`;
  }
}

export type BookingFollowUpPrefill = {
  bookingId: string;
  patientId: string | null;
  patientLabel: string | null;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
  legacyExternalId: string;
  isLegacyTimely: boolean;
  encounterType: FollowUpEncounterType;
  visitReason: string;
  clinicId: string | null;
  staffId: string | null;
  appointmentWhenLabel: string;
};

export function parsePersonNameFromMetadata(meta: Record<string, unknown>): {
  firstName: string;
  lastName: string;
  displayName: string;
} {
  const firstName = String(meta.first_name ?? "").trim();
  const lastName = String(meta.last_name ?? meta.surname ?? "").trim();
  const displayName =
    String(meta.display_name ?? meta.full_name ?? "").trim() ||
    `${firstName} ${lastName}`.trim() ||
    "Unknown";
  return { firstName, lastName, displayName };
}

export function readContactFromPersonMetadata(meta: Record<string, unknown>): {
  email: string;
  mobile: string;
  dateOfBirth: string;
  legacyExternalId: string;
  legacySource: string | null;
} {
  return {
    email: String(meta.email ?? meta.primary_email ?? "").trim(),
    mobile: String(meta.phone ?? meta.mobile ?? meta.primary_phone ?? "").trim(),
    dateOfBirth: String(meta.date_of_birth ?? "").trim(),
    legacyExternalId: String(
      meta.legacy_external_id ?? meta.timely_patient_id ?? meta.source_patient_id ?? ""
    ).trim(),
    legacySource: meta.legacy_source != null ? String(meta.legacy_source).trim() : null,
  };
}
