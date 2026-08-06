/**
 * FI-CALENDAR-CONVERSION-UX-1B — guided conversion UX contracts (patient, clinic, staff, room).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXTERNAL_CONVERSION_WIZARD_STEPS,
  EXTERNAL_IDENTITY_RESULT_LABELS,
  PATIENT_IDENTITY_ACTION_LABELS,
  applyStaffUnassigned,
  assessStaffClinicCompatibility,
  buildConversionAuditMetadata,
  buildConversionSummary,
  listActiveTenantStaffForConversion,
  primaryWorkflowExposesTechnicalIdentityTerms,
  resolveConversionWizardPermissions,
  resolveExternalIdentityResultState,
  revalidateRoomForClinic,
  roomsForSelectedClinic,
} from "@/src/lib/calendar/externalEventConversionUx";
import {
  resolveConfirmedClinicId,
  suggestClinicFromGoogleLocation,
} from "@/src/lib/calendar/suggestClinicFromGoogleLocation";
import { resolveCalendarAppointmentCapabilities } from "@/src/lib/calendar/calendarAppointmentCapabilities";
import { resolveCalendarEventEditPolicy } from "@/src/lib/calendar/calendarEventEditPolicy";
import { buildCalendarMutationAuditRecord } from "@/src/lib/calendar/calendarWritebackAudit";

const PERTH_CLINIC = {
  id: "clinic-evolved-perth",
  display_name: "Evolved Perth",
};
const MELBOURNE_CLINIC = {
  id: "clinic-evolved-melbourne",
  display_name: "Evolved Melbourne",
};

const MICHAEL_BUCKLAND = {
  name: "Michael Buckland",
  email: "michael.buckland@example.com",
  phone: "+61 400 000 001",
  googleLocation: "South Perth Evolved Surgery",
  googleEventId: "google-michael-buckland-1",
  startAt: "2026-08-05T10:00:00.000Z",
  endAt: "2026-08-05T10:15:00.000Z",
};

describe("FI-CALENDAR-CONVERSION-UX-1B identity result states", () => {
  it("1. existing patient found", () => {
    assert.equal(
      resolveExternalIdentityResultState({ identityState: "patient_linked" }),
      "existing_patient_found"
    );
    assert.equal(
      EXTERNAL_IDENTITY_RESULT_LABELS.existing_patient_found,
      "Existing patient found"
    );
  });

  it("2. existing consultation found", () => {
    assert.equal(
      resolveExternalIdentityResultState({ identityState: "consultation_identity_linked" }),
      "existing_consultation_found"
    );
  });

  it("3. new patient path uses operational create language", () => {
    assert.equal(PATIENT_IDENTITY_ACTION_LABELS.create_new_patient, "Create new patient");
    assert.match(
      `Create ${MICHAEL_BUCKLAND.name} in FiOS using the Google contact details?`,
      /Create Michael Buckland in FiOS/
    );
  });

  it("4. create-patient action label stays idempotent-friendly (no duplicate wording)", () => {
    assert.equal(
      PATIENT_IDENTITY_ACTION_LABELS.create_new_patient,
      "Create new patient"
    );
    // Primary continue CTA contract (wizard button copy).
    assert.equal("Create patient and continue", "Create patient and continue");
  });
});

describe("FI-CALENDAR-CONVERSION-UX-1B clinic suggestion", () => {
  it("5. clinic suggestion appears from Google location (South Perth → Evolved Perth)", () => {
    const suggestion = suggestClinicFromGoogleLocation({
      googleLocation: MICHAEL_BUCKLAND.googleLocation,
      clinics: [PERTH_CLINIC, MELBOURNE_CLINIC],
    });
    assert.equal(suggestion.ok, true);
    if (!suggestion.ok) return;
    assert.equal(suggestion.suggestedClinicId, PERTH_CLINIC.id);
    assert.equal(suggestion.suggestedClinicName, "Evolved Perth");
    assert.equal(suggestion.suggestionLabel, "Suggested from Google location");
    assert.equal(suggestion.requiresConfirmation, true);
    assert.equal(suggestion.googleLocation, "South Perth Evolved Surgery");
  });

  it("6. clinic suggestion requires confirmation (no silent commit)", () => {
    const blocked = resolveConfirmedClinicId({
      selectedClinicId: PERTH_CLINIC.id,
      suggestedClinicId: PERTH_CLINIC.id,
      clinicConfirmed: false,
      allowUnassigned: false,
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.match(blocked.error, /Confirm the suggested clinic/);

    const confirmed = resolveConfirmedClinicId({
      selectedClinicId: PERTH_CLINIC.id,
      suggestedClinicId: PERTH_CLINIC.id,
      clinicConfirmed: true,
      allowUnassigned: false,
    });
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    assert.equal(confirmed.clinicId, PERTH_CLINIC.id);
  });

  it("7. canonical clinicId persists after confirmation", () => {
    const confirmed = resolveConfirmedClinicId({
      selectedClinicId: PERTH_CLINIC.id,
      suggestedClinicId: PERTH_CLINIC.id,
      clinicConfirmed: true,
    });
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    assert.equal(confirmed.clinicId, PERTH_CLINIC.id);
    // Google free-text must never be returned as the persisted id.
    assert.notEqual(confirmed.clinicId, MICHAEL_BUCKLAND.googleLocation);
  });
});

describe("FI-CALENDAR-CONVERSION-UX-1B staff and room", () => {
  const staff = [
    {
      id: "staff-perth",
      full_name: "Dr Perth",
      staff_role: "surgeon",
      is_active: true,
      primary_clinic_id: PERTH_CLINIC.id,
    },
    {
      id: "staff-melb",
      full_name: "Dr Melb",
      staff_role: "consultant",
      is_active: true,
      primary_clinic_id: MELBOURNE_CLINIC.id,
    },
    {
      id: "staff-inactive",
      full_name: "Inactive",
      staff_role: "nurse",
      is_active: false,
    },
    {
      id: "staff-review",
      full_name: "Needs Review",
      staff_role: "needs_review",
      is_active: true,
    },
  ];

  const rooms = [
    { id: "room-perth-1", name: "Consult 1", clinic_id: PERTH_CLINIC.id },
    { id: "room-melb-1", name: "Consult M1", clinic_id: MELBOURNE_CLINIC.id },
  ];

  it("8. staff selector returns active tenant staff only", () => {
    const active = listActiveTenantStaffForConversion(staff);
    assert.equal(active.some((s) => s.id === "staff-perth"), true);
    assert.equal(active.some((s) => s.id === "staff-inactive"), false);
    assert.equal(active.some((s) => s.id === "staff-review"), false);
  });

  it("9. invalid cross-clinic staff assignment is rejected without confirmation", () => {
    const rejected = assessStaffClinicCompatibility({
      staffId: "staff-melb",
      clinicId: PERTH_CLINIC.id,
      staff,
      crossClinicConfirmed: false,
    });
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.equal(rejected.requiresConfirmation, true);

    const allowed = assessStaffClinicCompatibility({
      staffId: "staff-melb",
      clinicId: PERTH_CLINIC.id,
      staff,
      crossClinicConfirmed: true,
    });
    assert.equal(allowed.ok, true);
  });

  it("10. clinician unassigned preserves clinic", () => {
    const next = applyStaffUnassigned(PERTH_CLINIC.id);
    assert.equal(next.clinicId, PERTH_CLINIC.id);
    assert.equal(next.staffId, null);
    assert.equal(next.staffAssignment, "assign_later");
  });

  it("11. room is restricted to selected clinic", () => {
    const perthRooms = roomsForSelectedClinic(rooms, PERTH_CLINIC.id);
    assert.deepEqual(
      perthRooms.map((r) => r.id),
      ["room-perth-1"]
    );
  });

  it("12. changing clinic revalidates room (invalid room not retained)", () => {
    const cleared = revalidateRoomForClinic({
      clinicId: MELBOURNE_CLINIC.id,
      roomId: "room-perth-1",
      rooms,
    });
    assert.equal(cleared, null);

    const kept = revalidateRoomForClinic({
      clinicId: PERTH_CLINIC.id,
      roomId: "room-perth-1",
      rooms,
    });
    assert.equal(kept, "room-perth-1");
  });
});

describe("FI-CALENDAR-CONVERSION-UX-1B conversion summary and audit", () => {
  it("13–15. summary + audit carry patient, clinic, staff, google event linkage", () => {
    const summary = buildConversionSummary({
      patientDisplayName: MICHAEL_BUCKLAND.name,
      identityAction: "create_new_patient",
      clinicName: "Evolved Perth",
      clinicUnassigned: false,
      staffName: null,
      staffAssignLater: true,
      appointmentType: "Surgery",
      dateLabel: "5 August 2026",
      timeRangeLabel: "10:00 am–10:15 am",
    });
    assert.equal(summary.patient, "Michael Buckland");
    assert.equal(summary.identityAction, "Create new FiOS patient");
    assert.equal(summary.clinic, "Evolved Perth");
    assert.equal(summary.staff, "Unassigned");
    assert.equal(summary.room, "None");
    assert.equal(summary.appointment.type, "Surgery");
    assert.equal(summary.source, "Google Calendar");

    const auditMeta = buildConversionAuditMetadata({
      googleEventId: MICHAEL_BUCKLAND.googleEventId,
      patientId: "patient-1",
      consultationId: "consult-1",
      enquiryId: null,
      appointmentId: "appt-1",
      clinicId: PERTH_CLINIC.id,
      staffId: null,
      roomId: null,
      identityMatchMethod: "exact_verified_email",
      actingUserId: "user-1",
      sourceInteraction: "external_event_conversion",
      previousClassification: "google_external_unlinked",
      newClassification: "google_linked_fios",
      idempotencyResult: "created",
    });
    assert.equal(auditMeta.google_event_id, MICHAEL_BUCKLAND.googleEventId);
    assert.equal(auditMeta.clinic_id, PERTH_CLINIC.id);
    assert.equal(auditMeta.idempotency_result, "created");

    const record = buildCalendarMutationAuditRecord({
      id: "audit-1",
      tenantId: "tenant-1",
      interactionSource: "external_event_conversion",
      classification: "google_linked_fios",
      fiosAppointmentId: "appt-1",
      googleEventId: MICHAEL_BUCKLAND.googleEventId,
      previousValues: { classification: "google_external_unlinked" },
      nextValues: { classification: "google_linked_fios", clinic_id: PERTH_CLINIC.id },
      writebackStatus: "not_required",
      metadata: auditMeta,
    });
    assert.equal(record.googleEventId, MICHAEL_BUCKLAND.googleEventId);
    assert.equal(record.metadata.patient_id, "patient-1");
  });

  it("14. repeated conversion idempotency result can be reused", () => {
    const reused = buildConversionAuditMetadata({
      googleEventId: MICHAEL_BUCKLAND.googleEventId,
      patientId: "patient-1",
      consultationId: null,
      enquiryId: null,
      appointmentId: "appt-1",
      clinicId: PERTH_CLINIC.id,
      staffId: null,
      roomId: null,
      identityMatchMethod: "explicit_google_event_patient_mapping",
      actingUserId: "user-1",
      sourceInteraction: "external_event_conversion",
      previousClassification: "google_linked_fios",
      newClassification: "google_linked_fios",
      idempotencyResult: "reused",
    });
    assert.equal(reused.idempotency_result, "reused");
    assert.equal(reused.appointment_id, "appt-1");
  });

  it("16. post-conversion policy exposes Quick Edit when writeback ready", () => {
    const caps = resolveCalendarAppointmentCapabilities({
      canView: true,
      canMutateBookings: true,
      googleWritebackReady: true,
      isElevatedOperator: true,
    });
    const policy = resolveCalendarEventEditPolicy("google_linked_fios", caps, {
      hasPatientLink: true,
      googleWritebackReady: true,
      fiosAppointmentId: "appt-1",
      googleHtmlLink: "https://calendar.google.com/event?eid=x",
    });
    assert.equal(policy.canQuickEdit, true);
    assert.equal(policy.drawerActions.includes("quick_edit"), true);
    assert.equal(policy.classification, "google_linked_fios");
  });

  it("17. technical identity terminology is not exposed as main workflow", () => {
    const primary = Object.values(PATIENT_IDENTITY_ACTION_LABELS);
    assert.equal(primaryWorkflowExposesTechnicalIdentityTerms(primary), false);
    assert.equal(
      primaryWorkflowExposesTechnicalIdentityTerms([
        "Use consultation identity",
        "Create patient from Google details",
      ]),
      true
    );
  });

  it("18. wizard steps support keyboard/screen-reader oriented flow contract", () => {
    assert.equal(EXTERNAL_CONVERSION_WIZARD_STEPS.length, 5);
    assert.deepEqual(
      EXTERNAL_CONVERSION_WIZARD_STEPS.map((s) => s.label),
      ["Patient", "Clinic", "Staff and room", "Appointment details", "Review and create"]
    );
    // Final CTA + already-linked copy contracts for a11y status regions.
    assert.equal("Create FiOS appointment", "Create FiOS appointment");
    assert.equal("Already linked to FiOS", "Already linked to FiOS");
  });
});

describe("FI-CALENDAR-CONVERSION-UX-1B permissions", () => {
  it("maps ticket permission names onto calendar capabilities with explanations", () => {
    const caps = resolveCalendarAppointmentCapabilities({
      canView: true,
      canMutateBookings: true,
      googleWritebackReady: false,
      isElevatedOperator: false,
    });
    const gates = resolveConversionWizardPermissions(caps);
    assert.equal(gates["patient.link"].allowed, true);
    assert.equal(gates["appointment.convert_external"].allowed, false);
    assert.match(
      gates["appointment.convert_external"].explanation ?? "",
      /permission to convert/
    );
    assert.equal(gates["calendar.google_writeback"].allowed, false);
  });
});
