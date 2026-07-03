import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_CONTINUITY_LABELS,
  bookingContinuityLabel,
  buildVisitReasonFromBooking,
  deriveBookingContinuityStatus,
  encounterTypeForBookingType,
  formatBookingAppointmentWhen,
} from "./bookingFollowUpContextCore";
import {
  buildFollowUpImagingCaptureHref,
  buildFollowUpReturnHref,
  buildReturningPatientFlowHref,
} from "./followUpImagingRoutes";
import { canCreateFollowUpEncounter } from "./followUpEncounterPermissions";

describe("FI-LEGACY-FOLLOWUP-CALENDAR-ENTRY-1 — booking route prefill", () => {
  it("builds returning flow href with bookingId", () => {
    const href = buildReturningPatientFlowHref("tenant-1", {
      bookingId: "book-123",
      patientId: "pat-1",
      intent: "legacy",
    });
    assert.match(href, /bookingId=book-123/);
    assert.match(href, /patientId=pat-1/);
    assert.match(href, /intent=legacy/);
    assert.match(href, /\/patients\/returning/);
  });

  it("builds visit reason from booking context", () => {
    const reason = buildVisitReasonFromBooking({
      bookingType: "follow_up",
      title: "3-month review",
      startAt: "2026-06-15T10:00:00.000Z",
    });
    assert.match(reason, /3-month review/);
  });

  it("formats appointment when label", () => {
    const label = formatBookingAppointmentWhen(
      "2026-06-15T10:00:00.000Z",
      "2026-06-15T10:30:00.000Z",
      "UTC"
    );
    assert.ok(label.includes("–"));
  });
});

describe("FI-LEGACY-FOLLOWUP-CALENDAR-ENTRY-1 — encounter type mapping", () => {
  it("maps post-op booking to post_op_review", () => {
    assert.equal(encounterTypeForBookingType("post_op_review"), "post_op_review");
  });

  it("maps follow_up booking to follow_up", () => {
    assert.equal(encounterTypeForBookingType("follow_up"), "follow_up");
  });

  it("maps donor booking to donor_review", () => {
    assert.equal(encounterTypeForBookingType("donor_check"), "donor_review");
  });

  it("maps photos booking to photos_only", () => {
    assert.equal(encounterTypeForBookingType("photos_only"), "photos_only");
  });
});

describe("FI-LEGACY-FOLLOWUP-CALENDAR-ENTRY-1 — appointment continuity status", () => {
  it("shows no FI patient when unlinked", () => {
    const status = deriveBookingContinuityStatus({
      patientId: null,
      patientLegacySource: null,
      encounters: [],
      imagingSessions: [],
    });
    assert.equal(status, "no_fi_patient_linked");
    assert.equal(bookingContinuityLabel(status), BOOKING_CONTINUITY_LABELS.no_fi_patient_linked);
  });

  it("shows legacy timely when patient sourced from Timely", () => {
    const status = deriveBookingContinuityStatus({
      patientId: "pat-1",
      patientLegacySource: "timely",
      encounters: [],
      imagingSessions: [],
    });
    assert.equal(status, "legacy_timely_patient");
  });

  it("shows follow-up started when encounter exists", () => {
    const status = deriveBookingContinuityStatus({
      patientId: "pat-1",
      patientLegacySource: "timely",
      encounters: [{ id: "enc-1", status: "completed" }],
      imagingSessions: [],
    });
    assert.equal(status, "follow_up_started");
  });

  it("shows photos captured when session is partial", () => {
    const status = deriveBookingContinuityStatus({
      patientId: "pat-1",
      patientLegacySource: null,
      encounters: [{ id: "enc-1", status: "completed" }],
      imagingSessions: [{ ai_review_status: null, session_completeness_status: "partial" }],
    });
    assert.equal(status, "photos_captured");
  });

  it("shows AI review pending", () => {
    const status = deriveBookingContinuityStatus({
      patientId: "pat-1",
      patientLegacySource: null,
      encounters: [{ id: "enc-1", status: "completed" }],
      imagingSessions: [
        { ai_review_status: "ai_ready_for_review", session_completeness_status: "complete" },
      ],
    });
    assert.equal(status, "ai_imaging_review_pending");
  });

  it("shows clinician approved", () => {
    const status = deriveBookingContinuityStatus({
      patientId: "pat-1",
      patientLegacySource: null,
      encounters: [{ id: "enc-1", status: "completed" }],
      imagingSessions: [
        { ai_review_status: "clinician_approved", session_completeness_status: "complete" },
      ],
    });
    assert.equal(status, "clinician_approved");
  });
});

describe("FI-LEGACY-FOLLOWUP-CALENDAR-ENTRY-1 — imaging launch", () => {
  it("includes bookingId in imaging capture href for return navigation", () => {
    const href = buildFollowUpImagingCaptureHref("tid", "pid", "enc", "sess", {
      bookingId: "book-1",
    });
    assert.match(href, /returnBookingId=book-1/);
    assert.match(href, /protocolSessionId=sess/);
  });

  it("returns to calendar when bookingId present", () => {
    const href = buildFollowUpReturnHref("tid", { bookingId: "book-1", patientId: "pat-1" });
    assert.match(href, /calendar\?bookingId=book-1/);
  });
});

describe("FI-LEGACY-FOLLOWUP-CALENDAR-ENTRY-1 — permissions", () => {
  it("allows reception photos-only from calendar flow", () => {
    assert.equal(canCreateFollowUpEncounter("reception", "photos_only"), true);
  });

  it("blocks reception from donor review", () => {
    assert.equal(canCreateFollowUpEncounter("reception", "donor_review"), false);
  });
});

describe("FI-LEGACY-FOLLOWUP-CALENDAR-ENTRY-1 — no full consultation", () => {
  it("returning flow routes to patients/returning not consultations", () => {
    const href = buildReturningPatientFlowHref("tid", { bookingId: "b1" });
    assert.equal(href.includes("/consultations/"), false);
    assert.match(href, /patients\/returning/);
  });
});
