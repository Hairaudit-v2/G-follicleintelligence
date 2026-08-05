/**
 * FI-CALENDAR-WRITEBACK-1A — canonical source of truth per field
 * for Google-linked FiOS appointments (`google_linked_fios`).
 *
 * When FiOS initiates an edit, FiOS is the operational SoT for the change;
 * Google is updated via idempotent write-back. Concurrent Google edits are
 * detected via etag / version status and surfaced — never silently overwritten.
 */

export type CalendarFieldSourceOfTruth = "fios" | "google" | "dual_reconcile" | "fios_only";

export type CalendarFieldSoTEntry = {
  field: string;
  sourceOfTruth: CalendarFieldSourceOfTruth;
  notes: string;
  writeBackToGoogle: boolean;
};

/**
 * Field ownership for `google_linked_fios` events.
 * Native `fios_native` events are always FiOS-only (no Google side).
 */
export const GOOGLE_LINKED_FIOS_FIELD_SOURCE_OF_TRUTH: readonly CalendarFieldSoTEntry[] = [
  {
    field: "start_time",
    sourceOfTruth: "dual_reconcile",
    notes:
      "FiOS edit is authoritative for operator intent; Google PATCH write-back required before success. Concurrent Google change → conflict.",
    writeBackToGoogle: true,
  },
  {
    field: "end_time",
    sourceOfTruth: "dual_reconcile",
    notes: "Same as start_time — duration moves with end.",
    writeBackToGoogle: true,
  },
  {
    field: "title",
    sourceOfTruth: "fios",
    notes: "Mapped to Google `summary` only through defined appointment title mapping.",
    writeBackToGoogle: true,
  },
  {
    field: "description",
    sourceOfTruth: "fios",
    notes: "Mapped to Google `description` through defined mapping; clinical notes may be FiOS-only subset.",
    writeBackToGoogle: true,
  },
  {
    field: "location",
    sourceOfTruth: "fios",
    notes: "Room / site label written to Google `location` when appropriate.",
    writeBackToGoogle: true,
  },
  {
    field: "patient_id",
    sourceOfTruth: "fios_only",
    notes: "Never mirrored solely from Google attendee display names.",
    writeBackToGoogle: false,
  },
  {
    field: "lead_id",
    sourceOfTruth: "fios_only",
    notes: "CRM linkage is FiOS-only.",
    writeBackToGoogle: false,
  },
  {
    field: "assigned_staff_id",
    sourceOfTruth: "fios_only",
    notes: "Staff column assignment is FiOS operational; may affect which Google calendar is targeted via provider links.",
    writeBackToGoogle: false,
  },
  {
    field: "clinic_id",
    sourceOfTruth: "fios_only",
    notes: "Clinic assignment is FiOS-only.",
    writeBackToGoogle: false,
  },
  {
    field: "room_id",
    sourceOfTruth: "fios_only",
    notes: "Room id is FiOS-only; optional location string may write back.",
    writeBackToGoogle: false,
  },
  {
    field: "booking_status",
    sourceOfTruth: "fios_only",
    notes: "Clinical status (arrived, completed) stays in FiOS.",
    writeBackToGoogle: false,
  },
  {
    field: "external_event_id",
    sourceOfTruth: "google",
    notes: "Preserved forever — never reassigned on update.",
    writeBackToGoogle: false,
  },
  {
    field: "fios_appointment_id / local event id",
    sourceOfTruth: "fios",
    notes: "Preserved forever — never reassigned on update.",
    writeBackToGoogle: false,
  },
  {
    field: "etag / event version",
    sourceOfTruth: "dual_reconcile",
    notes: "Stored in fi_calendar_event_versions; If-Match on outbound PATCH; conflicts surfaced.",
    writeBackToGoogle: false,
  },
] as const;

export function fieldSourceOfTruth(field: string): CalendarFieldSoTEntry | undefined {
  return GOOGLE_LINKED_FIOS_FIELD_SOURCE_OF_TRUTH.find((e) => e.field === field);
}
