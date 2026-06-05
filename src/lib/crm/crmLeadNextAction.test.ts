import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveCrmLeadNextAction } from "./crmLeadNextAction";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { FiCrmTaskRow } from "./types";

function booking(partial: Partial<FiBookingRow> & { id: string; start_at: string }): FiBookingRow {
  return {
    id: partial.id,
    tenant_id: "t1",
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: partial.booking_type ?? "consultation",
    booking_status: partial.booking_status ?? "scheduled",
    title: partial.title ?? null,
    description: null,
    start_at: partial.start_at,
    end_at: partial.end_at ?? partial.start_at,
    timezone: "UTC",
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: partial.start_at,
    updated_at: partial.start_at,
  };
}

describe("deriveCrmLeadNextAction", () => {
  it("prefers due tasks over upcoming appointments", () => {
    const now = new Date("2026-06-05T12:00:00.000Z");
    const tasks = [
      {
        id: "task-1",
        title: "Call back",
        due_at: "2026-06-06T10:00:00.000Z",
        completed_at: null,
      } as FiCrmTaskRow,
    ];
    const bookings = [
      booking({
        id: "b1",
        start_at: "2026-06-07T10:00:00.000Z",
        booking_type: "consultation",
      }),
    ];
    const next = deriveCrmLeadNextAction(tasks, [], bookings, now);
    assert.equal(next.kind, "task");
    assert.equal(next.label, "Call back");
  });

  it("surfaces next upcoming appointment when no due tasks", () => {
    const now = new Date("2026-06-05T12:00:00.000Z");
    const bookings = [
      booking({
        id: "b1",
        start_at: "2026-06-07T10:00:00.000Z",
        booking_type: "surgery",
        title: "Procedure day",
      }),
    ];
    const next = deriveCrmLeadNextAction([], [], bookings, now);
    assert.equal(next.kind, "appointment");
    assert.match(next.label, /Hair Transplant/);
    assert.equal(next.atIso, "2026-06-07T10:00:00.000Z");
  });
});
