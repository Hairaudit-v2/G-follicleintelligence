import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  inferTimelyAppointmentLifecycleEvent,
  mapTimelyStatusToBookingStatus,
  normalizeTimelyLifecycleEventType,
} from "./timelyAppointmentLifecycle";

describe("timelyAppointmentLifecycle", () => {
  it("mapTimelyStatusToBookingStatus maps common Timely statuses", () => {
    assert.equal(mapTimelyStatusToBookingStatus("Cancelled"), "cancelled");
    assert.equal(mapTimelyStatusToBookingStatus("completed"), "completed");
    assert.equal(mapTimelyStatusToBookingStatus("No Show"), "no_show");
    assert.equal(mapTimelyStatusToBookingStatus("Confirmed"), "confirmed");
    assert.equal(mapTimelyStatusToBookingStatus("unknown"), null);
  });

  it("normalizeTimelyLifecycleEventType accepts aliases", () => {
    assert.equal(normalizeTimelyLifecycleEventType("appointment_cancelled"), "appointment_cancelled");
    assert.equal(normalizeTimelyLifecycleEventType("cancelled"), "appointment_cancelled");
    assert.equal(normalizeTimelyLifecycleEventType("reschedule"), "appointment_rescheduled");
    assert.equal(normalizeTimelyLifecycleEventType("noshow"), "appointment_no_show");
  });

  it("inferTimelyAppointmentLifecycleEvent prefers explicit event type", () => {
    assert.equal(
      inferTimelyAppointmentLifecycleEvent({
        explicitEventType: "appointment_rescheduled",
        hasExistingBooking: false,
      }),
      "appointment_rescheduled"
    );
  });

  it("inferTimelyAppointmentLifecycleEvent derives cancel from status", () => {
    assert.equal(
      inferTimelyAppointmentLifecycleEvent({
        status: "Cancelled",
        hasExistingBooking: true,
      }),
      "appointment_cancelled"
    );
  });

  it("inferTimelyAppointmentLifecycleEvent detects reschedule by time change", () => {
    assert.equal(
      inferTimelyAppointmentLifecycleEvent({
        hasExistingBooking: true,
        startTimeChanged: true,
      }),
      "appointment_rescheduled"
    );
  });

  it("inferTimelyAppointmentLifecycleEvent defaults to created", () => {
    assert.equal(
      inferTimelyAppointmentLifecycleEvent({
        hasExistingBooking: false,
      }),
      "appointment_created"
    );
  });
});
