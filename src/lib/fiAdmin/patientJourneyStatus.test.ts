import assert from "node:assert/strict";
import test from "node:test";

import { derivePatientJourneyStatus } from "./patientJourneyStatus";
import type { PatientConsultationListItem } from "@/src/lib/patients/patientConsultations";
import type { PatientDetailNextAppointment } from "@/src/lib/patients/patientDetailLoader";
import type { PreviousProcedureRow } from "@/src/lib/patients/previousProcedures";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function appt(overrides: Partial<PatientDetailNextAppointment> = {}): PatientDetailNextAppointment {
  return {
    id: "bk-1",
    startAt: "2026-08-01T09:00:00.000Z",
    title: "Consultation",
    bookingType: "consultation",
    bookingStatus: "scheduled",
    ...overrides,
  };
}

function consultation(
  status: PatientConsultationListItem["status"],
  overrides: Partial<PatientConsultationListItem> = {}
): PatientConsultationListItem {
  return {
    id: `c-${status}`,
    tenant_id: "t-1",
    person_id: "per-1",
    patient_id: "pat-1",
    lead_id: null,
    case_id: null,
    booking_id: null,
    consultation_type: "scalp_hair_transplant",
    consultation_type_label: "Scalp hair transplant",
    status,
    consultant_name: null,
    consultant_staff_id: null,
    consultation_date: "2026-07-01",
    structured_data: {},
    live_notes: null,
    recommendation_notes: null,
    quote_data: {},
    created_by: null,
    updated_by: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    archived_at: null,
    subject_line: "Scalp hair transplant · Jane Doe",
    patient_display_name: "Jane Doe",
    lead_display_name: null,
    link_headline: "Scalp hair transplant · Jane Doe",
    consultant_display_name: null,
    scalesSyncedToPatient: false,
    ...overrides,
  };
}

function procedure(overrides: Partial<PreviousProcedureRow> = {}): PreviousProcedureRow {
  return {
    id: "proc-1",
    procedureType: "FUE",
    performedAt: "2025-01-01",
    clinic: "FI Clinic",
    graftCount: 2000,
    outcome: "good",
    notes: null,
    ...overrides,
  };
}

function base() {
  return {
    totalLeads: 0,
    consultations: [] as PatientConsultationListItem[],
    nextAppointment: null as PatientDetailNextAppointment | null,
    treatmentPlanSummary: null as string | null,
    previousProcedures: [] as PreviousProcedureRow[],
    upcomingBookings: 0,
    completedBookings: 0,
  };
}

// ─── Stage: New enquiry ───────────────────────────────────────────────────────

test("returns 'New enquiry' when patient record has no data at all", () => {
  const s = derivePatientJourneyStatus(base());
  assert.equal(s.label, "New enquiry");
  assert.equal(s.tone, "neutral");
});

test("returns 'New enquiry' when empty even with completed bookings = 0", () => {
  const s = derivePatientJourneyStatus({ ...base(), completedBookings: 0 });
  assert.equal(s.label, "New enquiry");
});

// ─── Stage: Consultation pending ─────────────────────────────────────────────

test("returns 'Consultation pending' when lead exists but nothing else", () => {
  const s = derivePatientJourneyStatus({ ...base(), totalLeads: 1 });
  assert.equal(s.label, "Consultation pending");
  assert.equal(s.tone, "warning");
});

test("returns 'Consultation pending' with multiple leads but no appointment or consult", () => {
  const s = derivePatientJourneyStatus({ ...base(), totalLeads: 3 });
  assert.equal(s.label, "Consultation pending");
});

// ─── Stage: Dormant ───────────────────────────────────────────────────────────

test("returns 'Dormant' when completed bookings > 0 but no leads or consultations", () => {
  const s = derivePatientJourneyStatus({ ...base(), completedBookings: 2 });
  assert.equal(s.label, "Dormant");
  assert.equal(s.tone, "neutral");
});

// ─── Stage: Appointment booked ───────────────────────────────────────────────

test("returns 'Appointment booked' when appointment exists but no consultation", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    nextAppointment: appt(),
    totalLeads: 1,
  });
  assert.equal(s.label, "Appointment booked");
  assert.equal(s.tone, "info");
});

test("returns 'Appointment booked' with appointment and no leads", () => {
  const s = derivePatientJourneyStatus({ ...base(), nextAppointment: appt() });
  assert.equal(s.label, "Appointment booked");
});

// ─── Stage: Consultation in progress ─────────────────────────────────────────

test("returns 'Consultation in progress' for draft status", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("draft")],
  });
  assert.equal(s.label, "Consultation in progress");
  assert.equal(s.tone, "info");
});

test("returns 'Consultation in progress' for in_progress status", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("in_progress")],
  });
  assert.equal(s.label, "Consultation in progress");
});

// ─── Stage: Consultation completed ───────────────────────────────────────────

test("returns 'Consultation completed' when completed but no treatment plan", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("completed")],
  });
  assert.equal(s.label, "Consultation completed");
  assert.equal(s.tone, "success");
});

// ─── Stage: Treatment planning ────────────────────────────────────────────────

test("returns 'Treatment planning' when consultation completed AND treatment plan exists", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("completed")],
    treatmentPlanSummary: "FUE 2500 grafts · frontal restoration",
  });
  assert.equal(s.label, "Treatment planning");
  assert.equal(s.tone, "info");
});

test("returns 'Treatment planning' when quoted", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("quoted")],
  });
  assert.equal(s.label, "Treatment planning");
});

// ─── Stage: Surgery readiness pending ────────────────────────────────────────

test("returns 'Surgery readiness pending' when consultation accepted", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("accepted")],
  });
  assert.equal(s.label, "Surgery readiness pending");
  assert.equal(s.tone, "info");
});

// ─── Stage: Procedure scheduled ──────────────────────────────────────────────

test("returns 'Procedure scheduled' when consultation converted to case", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("converted_to_case")],
  });
  assert.equal(s.label, "Procedure scheduled");
  assert.equal(s.tone, "success");
});

// ─── Stage: Active treatment / Monitoring ─────────────────────────────────────

test("returns 'Active treatment' when procedure exists and upcoming bookings > 0", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    previousProcedures: [procedure()],
    upcomingBookings: 1,
    completedBookings: 2,
  });
  assert.equal(s.label, "Active treatment");
  assert.equal(s.tone, "success");
});

test("returns 'Monitoring / follow-up' when procedure exists, completed visits, no upcoming", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    previousProcedures: [procedure()],
    upcomingBookings: 0,
    completedBookings: 3,
  });
  assert.equal(s.label, "Monitoring / follow-up");
  assert.equal(s.tone, "info");
});

test("returns 'Post-procedure' when procedure exists but no bookings at all", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    previousProcedures: [procedure()],
  });
  assert.equal(s.label, "Post-procedure");
  assert.equal(s.tone, "neutral");
});

// ─── Priority ordering — later stages must win ────────────────────────────────

test("previous procedure wins over converted consultation", () => {
  // Both procedure + converted_to_case present → procedure stage should dominate
  const s = derivePatientJourneyStatus({
    ...base(),
    previousProcedures: [procedure()],
    consultations: [consultation("converted_to_case")],
    upcomingBookings: 1,
  });
  assert.equal(s.label, "Active treatment");
});

test("converted_to_case wins over accepted", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("converted_to_case"), consultation("accepted")],
  });
  assert.equal(s.label, "Procedure scheduled");
});

test("accepted wins over quoted", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("accepted"), consultation("quoted")],
  });
  assert.equal(s.label, "Surgery readiness pending");
});

test("quoted wins over completed with no plan", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("quoted"), consultation("completed")],
  });
  assert.equal(s.label, "Treatment planning");
});

test("completed wins over in_progress", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("completed"), consultation("in_progress")],
  });
  assert.equal(s.label, "Consultation completed");
});

test("appointment booked wins over consultation pending (lead)", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    totalLeads: 1,
    nextAppointment: appt(),
  });
  assert.equal(s.label, "Appointment booked");
});

test("archived consultation does not advance journey stage", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("archived")],
    totalLeads: 1,
  });
  // archived is not a meaningful forward stage; should fall through to lead-based stage
  assert.equal(s.label, "Consultation pending");
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test("handles multiple procedures — still uses procedure-tier logic", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    previousProcedures: [procedure(), procedure({ id: "proc-2" })],
    upcomingBookings: 2,
    completedBookings: 5,
  });
  assert.equal(s.label, "Active treatment");
});

test("treatment plan without consultation still falls through to correct stage", () => {
  // treatmentPlanSummary present but no consultations → should not claim Treatment planning
  const s = derivePatientJourneyStatus({
    ...base(),
    treatmentPlanSummary: "Some plan text",
    totalLeads: 1,
  });
  // Plan alone doesn't advance past lead stage
  assert.equal(s.label, "Consultation pending");
});

test("zero leads and zero bookings with draft consultation → in progress", () => {
  const s = derivePatientJourneyStatus({
    ...base(),
    consultations: [consultation("draft")],
  });
  assert.equal(s.label, "Consultation in progress");
});

test("all inputs empty strings and nulls → new enquiry", () => {
  const s = derivePatientJourneyStatus({
    totalLeads: 0,
    consultations: [],
    nextAppointment: null,
    treatmentPlanSummary: null,
    previousProcedures: [],
    upcomingBookings: 0,
    completedBookings: 0,
  });
  assert.equal(s.label, "New enquiry");
});

test("every output has required shape { label, tone, description }", () => {
  const inputs = [
    base(),
    { ...base(), totalLeads: 1 },
    { ...base(), nextAppointment: appt() },
    { ...base(), consultations: [consultation("draft")] },
    { ...base(), consultations: [consultation("completed")] },
    { ...base(), consultations: [consultation("completed")], treatmentPlanSummary: "plan" },
    { ...base(), consultations: [consultation("quoted")] },
    { ...base(), consultations: [consultation("accepted")] },
    { ...base(), consultations: [consultation("converted_to_case")] },
    { ...base(), previousProcedures: [procedure()], upcomingBookings: 1 },
    { ...base(), previousProcedures: [procedure()], completedBookings: 2 },
    { ...base(), completedBookings: 2 },
  ];
  for (const input of inputs) {
    const s = derivePatientJourneyStatus(input);
    assert.ok(
      typeof s.label === "string" && s.label.length > 0,
      `label missing for ${JSON.stringify(input)}`
    );
    assert.ok(
      ["neutral", "info", "warning", "success"].includes(s.tone),
      `invalid tone: ${s.tone}`
    );
    assert.ok(typeof s.description === "string" && s.description.length > 0, `description missing`);
  }
});
