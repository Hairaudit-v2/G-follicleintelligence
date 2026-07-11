/**
 * S3.4G — Tomorrow protection: pure model surface remains stable.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeTomorrowOperationalWindow,
  deriveTomorrowActionItems,
  isTomorrowAgendaBooking,
  TOMORROW_AGENDA_BOOKING_STATUSES,
} from "@/src/lib/clinicOs/tomorrowBoardModel";

test("Tomorrow operational window is deterministic for fixed clock", () => {
  const now = new Date("2026-07-12T10:00:00.000Z");
  const a = computeTomorrowOperationalWindow(now, "UTC");
  const b = computeTomorrowOperationalWindow(now, "UTC");
  assert.deepEqual(a, b);
  assert.equal(a.todayYmd, "2026-07-12");
  assert.equal(a.tomorrowYmd, "2026-07-13");
  assert.ok(a.localStartIso < a.localEndIso);
});

test("Tomorrow agenda status set is unchanged", () => {
  assert.deepEqual([...TOMORROW_AGENDA_BOOKING_STATUSES], ["scheduled", "confirmed", "arrived"]);
});

test("Tomorrow agenda booking filter uses operational window", () => {
  const window = computeTomorrowOperationalWindow(new Date("2026-07-12T10:00:00.000Z"), "UTC");
  assert.equal(
    isTomorrowAgendaBooking(
      { start_at: "2026-07-13T12:00:00.000Z", booking_status: "scheduled" },
      window
    ),
    true
  );
  assert.equal(
    isTomorrowAgendaBooking(
      { start_at: "2026-07-12T12:00:00.000Z", booking_status: "scheduled" },
      window
    ),
    false
  );
});

test("deriveTomorrowActionItems is stable for empty input", () => {
  const window = computeTomorrowOperationalWindow(new Date("2026-07-12T10:00:00.000Z"), "UTC");
  const input = {
    window,
    agendaBookings: [],
    surgeryReadiness: [],
    surgeryPayments: {
      byBookingId: new Map(),
      byCaseId: new Map(),
    },
    bookingLabel: () => "label",
  };
  const a = deriveTomorrowActionItems(input);
  const b = deriveTomorrowActionItems(input);
  assert.deepEqual(a, b);
  assert.deepEqual(a, []);
});
