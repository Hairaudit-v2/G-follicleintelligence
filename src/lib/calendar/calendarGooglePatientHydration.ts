/**
 * FI-CALENDAR-PATIENT-LINK-1A — hydrate candidate patient fields from a Google Calendar event.
 * Pure helpers (no I/O). Never treats the clinic organizer as the patient.
 */

import { normalizeEmail, normalizeWhitespaceName } from "@/src/lib/fi/foundation/normalize";
import {
  normalizeCalendarIdentityPhone,
  verifiedCalendarIdentityEmail,
} from "@/src/lib/calendar/calendarPersonIdentityNormalize";

export type GoogleAttendeeLike = {
  email?: string | null;
  displayName?: string | null;
  responseStatus?: string | null;
  self?: boolean | null;
  organizer?: boolean | null;
  resource?: boolean | null;
};

export type GoogleEventHydrationInput = {
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  attendees?: readonly GoogleAttendeeLike[] | null;
  organizerEmail?: string | null;
  creatorEmail?: string | null;
  /** Calendar id when it is an email (e.g. primary clinic calendar). */
  calendarId?: string | null;
  /** Connected Google account for the clinic (never treated as patient). */
  clinicAccountEmail?: string | null;
};

export type GooglePatientHydration = {
  displayName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  attendeeDisplayName: string | null;
  appointmentTypeHint: string | null;
  source: "google_event";
};

const PHONE_LABEL_RE =
  /(?:^|\n|\r|<br\s*\/?>)\s*(?:sms|mobile|phone|tel|cell|contact|mobi(?:le)?)\s*[:：\-–]?\s*([+\d][\d\s().\-]{5,}\d)/gi;

const EMAIL_LABEL_RE =
  /(?:^|\n|\r|<br\s*\/?>)\s*(?:e-?mail)\s*[:：\-–]?\s*([^\s<>\n\r]+@[^\s<>\n\r]+)/gi;

const LOCATION_LABEL_RE =
  /(?:^|\n|\r|<br\s*\/?>)\s*(?:location|loc)\s*[:：\-–]?\s*([^\n\r<]+)/gi;

const APPOINTMENT_TYPE_HINT_RE =
  /\b((?:follow[\s-]?up|new|initial|virtual|in[\s-]?person)?\s*consultation|surgery|procedure|review|assessment)\b/i;

const LOOSE_PHONE_RE = /(?:\+?\d[\d\s().\-]{6,}\d)/g;

function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

/** Clinic / calendar addresses that must never be treated as the patient email. */
export function isClinicSideEmail(
  email: string | null | undefined,
  clinicEmails: ReadonlyArray<string | null | undefined>
): boolean {
  const n = normalizeEmail(email);
  if (!n) return true;
  for (const raw of clinicEmails) {
    const c = normalizeEmail(raw);
    if (c && c === n) return true;
  }
  // Common resource / conference rooms.
  if (n.includes("resource.calendar.google.com")) return true;
  if (n.endsWith("@group.calendar.google.com")) return true;
  return false;
}

/** Prefer non-clinic, non-self, non-resource attendee as the patient. */
export function selectPatientAttendee(
  attendees: readonly GoogleAttendeeLike[] | null | undefined,
  clinicEmails: ReadonlyArray<string | null | undefined>
): GoogleAttendeeLike | null {
  if (!attendees?.length) return null;
  const candidates = attendees.filter((a) => {
    if (a.self === true || a.organizer === true || a.resource === true) return false;
    if (isClinicSideEmail(a.email, clinicEmails)) return false;
    return Boolean(verifiedCalendarIdentityEmail(a.email ?? null));
  });
  if (candidates.length === 0) return null;
  // Prefer declined-less attendees with a display name.
  const withName = candidates.find((c) => c.displayName?.trim());
  return withName ?? candidates[0] ?? null;
}

/** Parse the first plausible mobile/phone from a Google event description. */
export function parsePhoneFromGoogleDescription(description: string | null | undefined): string | null {
  if (!description?.trim()) return null;
  const text = stripHtml(description);
  PHONE_LABEL_RE.lastIndex = 0;
  let labelled: RegExpExecArray | null;
  while ((labelled = PHONE_LABEL_RE.exec(text)) != null) {
    const n = normalizeCalendarIdentityPhone(labelled[1]);
    if (n) return n;
  }
  LOOSE_PHONE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LOOSE_PHONE_RE.exec(text)) != null) {
    const n = normalizeCalendarIdentityPhone(match[0]);
    if (n) return n;
  }
  return null;
}

/** Parse labelled Email: from description when attendees are missing. */
export function parseEmailFromGoogleDescription(description: string | null | undefined): string | null {
  if (!description?.trim()) return null;
  const text = stripHtml(description);
  EMAIL_LABEL_RE.lastIndex = 0;
  const match = EMAIL_LABEL_RE.exec(text);
  return verifiedCalendarIdentityEmail(match?.[1] ?? null);
}

/** Parse labelled Location: from description when the Google location field is empty. */
export function parseLocationFromGoogleDescription(description: string | null | undefined): string | null {
  if (!description?.trim()) return null;
  const text = stripHtml(description);
  LOCATION_LABEL_RE.lastIndex = 0;
  const match = LOCATION_LABEL_RE.exec(text);
  const loc = match?.[1]?.trim();
  return loc || null;
}

/** Best-effort appointment type from structured description lines. */
export function parseAppointmentTypeHintFromGoogleDescription(
  description: string | null | undefined
): string | null {
  if (!description?.trim()) return null;
  const text = stripHtml(description);
  const firstLine = text.split(/\n|\r/)[0]?.trim() || "";
  const match = APPOINTMENT_TYPE_HINT_RE.exec(firstLine) || APPOINTMENT_TYPE_HINT_RE.exec(text);
  if (!match?.[1]) return null;
  return match[1].replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || null;
}

/**
 * Hydrate candidate patient display fields from a Google event.
 * Does not create or link patients. Safe to show in the drawer before linking.
 */
export function hydratePatientFromGoogleEvent(
  input: GoogleEventHydrationInput
): GooglePatientHydration {
  const clinicEmails = [
    input.organizerEmail,
    input.creatorEmail,
    input.calendarId,
    input.clinicAccountEmail,
  ];
  const attendee = selectPatientAttendee(input.attendees, clinicEmails);
  const attendeeDisplayName = attendee?.displayName?.trim() || null;
  const summaryName = input.summary?.trim() || null;
  // Prefer attendee display name; fall back to event summary (common when title is the patient name).
  const displayName = attendeeDisplayName || summaryName || null;
  const email =
    verifiedCalendarIdentityEmail(attendee?.email ?? null) ||
    parseEmailFromGoogleDescription(input.description);
  const phone = parsePhoneFromGoogleDescription(input.description);
  const location =
    input.location?.trim() || parseLocationFromGoogleDescription(input.description) || null;
  const appointmentTypeHint = parseAppointmentTypeHintFromGoogleDescription(input.description);

  return {
    displayName,
    email,
    phone,
    location,
    attendeeDisplayName,
    appointmentTypeHint,
    source: "google_event",
  };
}

/** Normalised name key for low-confidence exact-name suggestions (not auto-link). */
export function normalizedGooglePatientNameKey(name: string | null | undefined): string | null {
  return normalizeWhitespaceName(name);
}

/** Read previously persisted hydration from `fi_calendar_events.metadata`. */
export function readPersistedGooglePatientHydration(
  metadata: Record<string, unknown> | null | undefined,
  fallback?: {
    title?: string | null;
    description?: string | null;
    location?: string | null;
  }
): GooglePatientHydration {
  const meta = metadata ?? {};
  const nested =
    meta.google_patient_hydration &&
    typeof meta.google_patient_hydration === "object" &&
    !Array.isArray(meta.google_patient_hydration)
      ? (meta.google_patient_hydration as Record<string, unknown>)
      : null;

  const displayName =
    (typeof nested?.display_name === "string" && nested.display_name.trim()) ||
    (typeof meta.patient_display_name === "string" && meta.patient_display_name.trim()) ||
    (typeof meta.attendee_display_name === "string" && meta.attendee_display_name.trim()) ||
    fallback?.title?.trim() ||
    null;

  const email =
    verifiedCalendarIdentityEmail(
      (typeof nested?.email === "string" && nested.email) ||
        (typeof meta.attendee_email === "string" && meta.attendee_email) ||
        (typeof meta.patient_email === "string" && meta.patient_email) ||
        null
    ) || parseEmailFromGoogleDescription(fallback?.description);

  const phone =
    normalizeCalendarIdentityPhone(
      (typeof nested?.phone === "string" && nested.phone) ||
        (typeof meta.attendee_phone === "string" && meta.attendee_phone) ||
        (typeof meta.patient_phone === "string" && meta.patient_phone) ||
        null
    ) || parsePhoneFromGoogleDescription(fallback?.description) || null;

  const location =
    (typeof nested?.location === "string" && nested.location.trim()) ||
    (typeof meta.patient_location === "string" && meta.patient_location.trim()) ||
    fallback?.location?.trim() ||
    parseLocationFromGoogleDescription(fallback?.description) ||
    null;

  return {
    displayName,
    email,
    phone,
    location,
    attendeeDisplayName:
      (typeof nested?.attendee_display_name === "string" && nested.attendee_display_name.trim()) ||
      (typeof meta.attendee_display_name === "string" && meta.attendee_display_name.trim()) ||
      null,
    appointmentTypeHint:
      (typeof nested?.appointment_type_hint === "string" && nested.appointment_type_hint.trim()) ||
      parseAppointmentTypeHintFromGoogleDescription(fallback?.description) ||
      null,
    source: "google_event",
  };
}

/** Flatten hydration into metadata keys used by identity resolution + drawer. */
export function googlePatientHydrationToMetadata(
  hydration: GooglePatientHydration
): Record<string, unknown> {
  return {
    google_patient_hydration: {
      display_name: hydration.displayName,
      email: hydration.email,
      phone: hydration.phone,
      location: hydration.location,
      attendee_display_name: hydration.attendeeDisplayName,
      appointment_type_hint: hydration.appointmentTypeHint,
      source: hydration.source,
    },
    ...(hydration.email ? { attendee_email: hydration.email, patient_email: hydration.email } : {}),
    ...(hydration.phone ? { attendee_phone: hydration.phone, patient_phone: hydration.phone } : {}),
    ...(hydration.displayName
      ? {
          patient_display_name: hydration.displayName,
          attendee_display_name: hydration.attendeeDisplayName ?? hydration.displayName,
        }
      : {}),
    ...(hydration.location ? { patient_location: hydration.location } : {}),
  };
}
