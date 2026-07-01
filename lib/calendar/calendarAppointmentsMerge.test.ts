import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeCalendarBookingDisplayOnHydrate,
  mergeCalendarBookingsOnHydrate,
} from "./calendarAppointmentsMerge";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";

function row(id: string, start: string): FiBookingRow {
  return {
    id,
    tenant_id: "tenant-1",
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    room_id: null,
    room_required: false,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "scheduled",
    title: id,
    description: null,
    start_at: start,
    end_at: new Date(Date.parse(start) + 30 * 60_000).toISOString(),
    timezone: "Australia/Perth",
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: start,
    updated_at: start,
  };
}

describe("mergeCalendarBookingsOnHydrate", () => {
  it("keeps client-only bookings missing from server payload", () => {
    const server = [row("a", "2026-06-10T01:00:00.000Z")];
    const client = [row("a", "2026-06-10T01:00:00.000Z"), row("b", "2026-06-10T03:00:00.000Z")];
    const merged = mergeCalendarBookingsOnHydrate(server, client);
    assert.equal(merged.length, 2);
    assert.deepEqual(
      merged.map((b) => b.id),
      ["a", "b"]
    );
  });

  it("prefers server row when both sides have the same id", () => {
    const server = [row("a", "2026-06-10T02:00:00.000Z")];
    const client = [row("a", "2026-06-10T01:00:00.000Z")];
    const merged = mergeCalendarBookingsOnHydrate(server, client);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.start_at, server[0]?.start_at);
  });
});

describe("mergeCalendarBookingDisplayOnHydrate", () => {
  it("carries client display hints for merged-only bookings", () => {
    const bookings = [row("b", "2026-06-10T03:00:00.000Z")];
    const server: Record<string, OperationalCalendarBookingDisplay> = {};
    const client: Record<string, OperationalCalendarBookingDisplay> = {
      b: {
        anchorLabel: "Quick book",
        scalesSummary: null,
        durationMin: 30,
        reminderHint: null,
      },
    };
    const merged = mergeCalendarBookingDisplayOnHydrate(server, client, bookings);
    assert.equal(merged.b?.anchorLabel, "Quick book");
  });

  it("merges server bookings by id without dropping unchanged rows", () => {
    const server = [
      row("a", "2026-06-10T02:00:00.000Z"),
      row("c", "2026-06-10T04:00:00.000Z"),
    ];
    const client = [
      row("a", "2026-06-10T01:00:00.000Z"),
      row("b", "2026-06-10T03:00:00.000Z"),
    ];
    const merged = mergeCalendarBookingsOnHydrate(server, client);
    assert.equal(merged.length, 3);
    assert.equal(merged.find((b) => b.id === "a")?.start_at, server[0]?.start_at);
    assert.ok(merged.some((b) => b.id === "b"));
  });

  it("prefers client anchor label when server sends uuid truncation", () => {
    const bookings = [row("a", "2026-06-10T01:00:00.000Z")];
    const server: Record<string, OperationalCalendarBookingDisplay> = {
      a: {
        anchorLabel: "Patient 8ebbba…",
        scalesSummary: null,
        durationMin: 30,
        reminderHint: null,
      },
    };
    const client: Record<string, OperationalCalendarBookingDisplay> = {
      a: {
        anchorLabel: "Jamie Fox",
        scalesSummary: null,
        durationMin: 30,
        reminderHint: null,
      },
    };
    const merged = mergeCalendarBookingDisplayOnHydrate(server, client, bookings);
    assert.equal(merged.a?.anchorLabel, "Jamie Fox");
  });
});
