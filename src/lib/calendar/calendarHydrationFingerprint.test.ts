import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";

import {
  calendarBookingDisplayHydrationFingerprint,
  calendarBookingsHydrationFingerprint,
} from "./calendarHydrationFingerprint";

function booking(base: Pick<FiBookingRow, "id"> & Partial<FiBookingRow>): FiBookingRow {
  const start = base.start_at ?? "2026-06-10T01:00:00.000Z";
  const end = base.end_at ?? "2026-06-10T01:30:00.000Z";
  return {
    id: base.id,
    tenant_id: base.tenant_id ?? "00000000-0000-0000-0000-000000000001",
    lead_id: base.lead_id ?? null,
    person_id: base.person_id ?? null,
    patient_id: base.patient_id ?? null,
    case_id: base.case_id ?? null,
    clinic_id: base.clinic_id ?? null,
    room_id: base.room_id ?? null,
    room_required: base.room_required ?? false,
    assigned_staff_id: base.assigned_staff_id ?? null,
    assigned_user_id: base.assigned_user_id ?? null,
    booking_type: base.booking_type ?? "consultation",
    booking_status: base.booking_status ?? "scheduled",
    title: base.title ?? "t",
    description: base.description ?? null,
    start_at: start,
    end_at: end,
    timezone: base.timezone ?? "Australia/Perth",
    location: base.location ?? null,
    metadata: base.metadata ?? {},
    cancelled_at: base.cancelled_at ?? null,
    cancelled_by_user_id: base.cancelled_by_user_id ?? null,
    cancellation_reason: base.cancellation_reason ?? null,
    created_by_user_id: base.created_by_user_id ?? null,
    created_at: base.created_at ?? start,
    updated_at: base.updated_at ?? start,
  };
}

describe("calendarBookingsHydrationFingerprint", () => {
  it("is stable for new array identity when booking content is unchanged", () => {
    const a = [booking({ id: "a" })];
    const b = [booking({ id: "a" })];
    assert.notStrictEqual(a, b);
    assert.equal(calendarBookingsHydrationFingerprint(a), calendarBookingsHydrationFingerprint(b));
  });

  it("changes when booking_status changes even if updated_at is unchanged", () => {
    const base = { id: "a", updated_at: "2026-06-10T00:00:00.000Z" as const };
    const fp1 = calendarBookingsHydrationFingerprint([
      booking({ ...base, booking_status: "scheduled" }),
    ]);
    const fp2 = calendarBookingsHydrationFingerprint([
      booking({ ...base, booking_status: "cancelled" }),
    ]);
    assert.notEqual(fp1, fp2);
  });

  it("changes when start_at changes", () => {
    const fp1 = calendarBookingsHydrationFingerprint([
      booking({ id: "a", start_at: "2026-06-10T01:00:00.000Z" }),
    ]);
    const fp2 = calendarBookingsHydrationFingerprint([
      booking({ id: "a", start_at: "2026-06-10T02:00:00.000Z" }),
    ]);
    assert.notEqual(fp1, fp2);
  });
});

describe("calendarBookingDisplayHydrationFingerprint", () => {
  it("changes when scalesSummary is populated (week/day enrichment vs month summary)", () => {
    const d1: Record<string, OperationalCalendarBookingDisplay> = {
      a: {
        anchorLabel: "Pat",
        scalesSummary: null,
        durationMin: 30,
        reminderHint: null,
        procedureCatalogName: "Consultation",
      },
    };
    const d2: Record<string, OperationalCalendarBookingDisplay> = {
      a: {
        anchorLabel: "Pat",
        scalesSummary: "Norwood III",
        durationMin: 30,
        reminderHint: null,
        procedureCatalogName: "Consultation",
      },
    };
    assert.notEqual(
      calendarBookingDisplayHydrationFingerprint(d1),
      calendarBookingDisplayHydrationFingerprint(d2)
    );
  });
});
