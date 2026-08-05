/**
 * FI-CALENDAR-PATIENT-LINK-1A — evidence path + Michael Berry Google event fixture.
 *
 * Defect record: docs/audits/calendar-patient-link/FI-CALENDAR-PATIENT-LINK-1A.md
 * Screenshot evidence: docs/audits/calendar-patient-link/fi-calendar-patient-link-1a-michael-berry-google-event.png
 */

export const FI_CALENDAR_PATIENT_LINK_1A_EVIDENCE_PATH =
  "docs/audits/calendar-patient-link/fi-calendar-patient-link-1a-michael-berry-google-event.png" as const;

export const MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE = {
  summary: "Michael Berry",
  startLocalHint: "2026-08-06T16:00:00",
  endLocalHint: "2026-08-06T16:30:00",
  location: "South Perth Evolved Surgery",
  guestEmail: "m.berry2011@hotmail.com",
  clinicCalendarEmail: "support@follicleintelligence.ai",
  createdBy: "Paul Green",
  description: [
    "Michael Berry - Follow-Up Consultation with Paul Green [Pending]",
    "SMS: 421412307",
    "Email: m.berry2011@hotmail.com",
    "Location: South Perth Evolved Surgery",
  ].join("\n"),
  smsRaw: "421412307",
  expectedPhoneDigits: "61421412307",
  expectedAppointmentTypeHint: "Follow-Up Consultation",
} as const;
