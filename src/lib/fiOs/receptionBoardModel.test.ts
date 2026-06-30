import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bookingStartFallsOnOperationalWindow,
  FI_RECEPTION_FLOW_PHASE_KEY,
  receptionBoardColumnForBooking,
  withReceptionFlowPhase,
} from "./receptionBoardModel";

test("bookingStartFallsOnOperationalWindow: inclusive start, exclusive end", () => {
  const start = "2026-06-10T02:00:00.000Z";
  const dayStart = "2026-06-10T00:00:00.000Z";
  const dayEnd = "2026-06-11T00:00:00.000Z";
  assert.equal(bookingStartFallsOnOperationalWindow(start, dayStart, dayEnd), true);
  assert.equal(bookingStartFallsOnOperationalWindow(dayStart, dayStart, dayEnd), true);
  assert.equal(bookingStartFallsOnOperationalWindow(dayEnd, dayStart, dayEnd), false);
  assert.equal(
    bookingStartFallsOnOperationalWindow("2026-06-09T23:59:59.999Z", dayStart, dayEnd),
    false
  );
});

test("receptionBoardColumnForBooking: terminal and expected statuses", () => {
  assert.equal(
    receptionBoardColumnForBooking({ booking_status: "cancelled", metadata: {} }),
    "cancelled"
  );
  assert.equal(
    receptionBoardColumnForBooking({ booking_status: "completed", metadata: {} }),
    "complete"
  );
  assert.equal(
    receptionBoardColumnForBooking({ booking_status: "no_show", metadata: {} }),
    "no_show"
  );
  assert.equal(
    receptionBoardColumnForBooking({ booking_status: "scheduled", metadata: {} }),
    "expected"
  );
  assert.equal(
    receptionBoardColumnForBooking({ booking_status: "confirmed", metadata: {} }),
    "expected"
  );
});

test("receptionBoardColumnForBooking: arrived with optional metadata phase", () => {
  assert.equal(
    receptionBoardColumnForBooking({ booking_status: "arrived", metadata: {} }),
    "arrived"
  );
  assert.equal(
    receptionBoardColumnForBooking({
      booking_status: "arrived",
      metadata: { [FI_RECEPTION_FLOW_PHASE_KEY]: "consultation" },
    }),
    "in_consultation"
  );
  assert.equal(
    receptionBoardColumnForBooking({
      booking_status: "arrived",
      metadata: { [FI_RECEPTION_FLOW_PHASE_KEY]: "treatment" },
    }),
    "in_treatment"
  );
});

test("receptionBoardColumnForBooking: unknown status maps to expected", () => {
  assert.equal(
    receptionBoardColumnForBooking({ booking_status: "pending_review", metadata: {} }),
    "expected"
  );
});

test("withReceptionFlowPhase: sets and clears phase key", () => {
  const base = { foo: 1 } as Record<string, unknown>;
  const withConsult = withReceptionFlowPhase(base, "consultation");
  assert.equal(withConsult[FI_RECEPTION_FLOW_PHASE_KEY], "consultation");
  assert.equal(withConsult.foo, 1);
  const cleared = withReceptionFlowPhase(withConsult, null);
  assert.equal(Object.prototype.hasOwnProperty.call(cleared, FI_RECEPTION_FLOW_PHASE_KEY), false);
});
