import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bookingStartFallsOnOperationalWindow,
  compareReceptionLaneItems,
  deriveReceptionOperationalState,
  FI_RECEPTION_FLOW_PHASE_KEY,
  isBookingArrivingSoon,
  isBookingRunningLate,
  isBookingWaiting,
  isReceptionOperationalTerminalState,
  RECEPTION_ARRIVING_SOON_WINDOW_MINUTES,
  RECEPTION_RUNNING_LATE_GRACE_MINUTES,
  receptionBoardColumnForBooking,
  receptionBoardColumnFromOperationalState,
  sortReceptionLaneItems,
  withReceptionFlowPhase,
} from "./receptionBoardModel";

/** Fixed clock: 2026-07-11T12:00:00.000Z */
const NOW_MS = Date.parse("2026-07-11T12:00:00.000Z");
const NOW_ISO = "2026-07-11T12:00:00.000Z";

function derive(input: {
  bookingStatus: string;
  startAtIso?: string | null;
  metadata?: Record<string, unknown> | null;
  arrivingSoonWindowMinutes?: number;
  runningLateGraceMinutes?: number;
}) {
  return deriveReceptionOperationalState({
    nowMs: NOW_MS,
    ...input,
  });
}

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

test("legacy receptionBoardColumnForBooking: terminal and expected statuses", () => {
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

test("legacy receptionBoardColumnForBooking: arrived with optional metadata phase", () => {
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

test("legacy receptionBoardColumnForBooking: unknown status maps to expected", () => {
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

// --- S3.1 operational derivation ---

test("1. scheduled booking outside arriving-soon window → expected", () => {
  // Window default 60 min; start is 2h ahead.
  const start = "2026-07-11T14:00:00.000Z";
  assert.equal(derive({ bookingStatus: "scheduled", startAtIso: start }), "expected");
  assert.equal(isBookingArrivingSoon({ bookingStatus: "scheduled", startAtIso: start, nowMs: NOW_MS }), false);
});

test("2. scheduled booking inside arriving-soon window → arriving_soon", () => {
  const start = "2026-07-11T12:30:00.000Z"; // 30 min ahead
  assert.equal(derive({ bookingStatus: "scheduled", startAtIso: start }), "arriving_soon");
  assert.equal(isBookingArrivingSoon({ bookingStatus: "scheduled", startAtIso: start, nowMs: NOW_MS }), true);
});

test("3. confirmed booking past start + grace → running_late", () => {
  // Default grace is 10 minutes; 1h past start is late.
  const start = "2026-07-11T11:00:00.000Z";
  assert.equal(derive({ bookingStatus: "confirmed", startAtIso: start }), "running_late");
  assert.equal(isBookingRunningLate({ bookingStatus: "confirmed", startAtIso: start, nowMs: NOW_MS }), true);
  // Within default 10m grace: not yet running late
  const withinGrace = "2026-07-11T11:55:00.000Z"; // 5 min before now
  assert.equal(derive({ bookingStatus: "confirmed", startAtIso: withinGrace }), "expected");
});

test("4. arrived booking past start → waiting, not running_late", () => {
  const start = "2026-07-11T10:00:00.000Z";
  assert.equal(
    derive({ bookingStatus: "arrived", startAtIso: start, metadata: {} }),
    "waiting"
  );
  assert.equal(isBookingWaiting({ bookingStatus: "arrived", metadata: {} }), true);
  assert.equal(
    isBookingRunningLate({ bookingStatus: "arrived", startAtIso: start, nowMs: NOW_MS }),
    false
  );
});

test("5. arrived + consultation phase → in_consultation", () => {
  assert.equal(
    derive({
      bookingStatus: "arrived",
      startAtIso: "2026-07-11T10:00:00.000Z",
      metadata: { [FI_RECEPTION_FLOW_PHASE_KEY]: "consultation" },
    }),
    "in_consultation"
  );
});

test("6. arrived + treatment phase → in_treatment", () => {
  assert.equal(
    derive({
      bookingStatus: "arrived",
      startAtIso: "2026-07-11T10:00:00.000Z",
      metadata: { [FI_RECEPTION_FLOW_PHASE_KEY]: "treatment" },
    }),
    "in_treatment"
  );
});

test("7. complete overrides every active state", () => {
  assert.equal(
    derive({
      bookingStatus: "completed",
      startAtIso: "2026-07-11T10:00:00.000Z",
      metadata: { [FI_RECEPTION_FLOW_PHASE_KEY]: "consultation" },
    }),
    "complete"
  );
  assert.ok(isReceptionOperationalTerminalState("complete"));
});

test("8. cancelled overrides every active state", () => {
  assert.equal(
    derive({
      bookingStatus: "cancelled",
      startAtIso: "2026-07-11T12:15:00.000Z",
      metadata: { [FI_RECEPTION_FLOW_PHASE_KEY]: "treatment" },
    }),
    "cancelled"
  );
});

test("9. no-show overrides every active state", () => {
  assert.equal(
    derive({
      bookingStatus: "no_show",
      startAtIso: "2026-07-11T11:00:00.000Z",
    }),
    "no_show"
  );
});

test("10. missing or invalid start time fails safely → expected (not late/soon)", () => {
  assert.equal(derive({ bookingStatus: "scheduled", startAtIso: null }), "expected");
  assert.equal(derive({ bookingStatus: "scheduled", startAtIso: "" }), "expected");
  assert.equal(derive({ bookingStatus: "scheduled", startAtIso: "not-a-date" }), "expected");
  assert.equal(derive({ bookingStatus: "confirmed" }), "expected");
});

test("11. boundary exactly at arriving-soon threshold", () => {
  const windowMin = RECEPTION_ARRIVING_SOON_WINDOW_MINUTES;
  // start = now + window → arriving_soon
  const atBoundary = new Date(NOW_MS + windowMin * 60_000).toISOString();
  assert.equal(derive({ bookingStatus: "scheduled", startAtIso: atBoundary }), "arriving_soon");
  // start = now + window + 1ms → expected
  const pastBoundary = new Date(NOW_MS + windowMin * 60_000 + 1).toISOString();
  assert.equal(derive({ bookingStatus: "scheduled", startAtIso: pastBoundary }), "expected");
});

test("12. boundary exactly at running-late grace threshold", () => {
  const graceMin = RECEPTION_RUNNING_LATE_GRACE_MINUTES; // default 10
  // start + grace = now → running_late (inclusive)
  const startAtGrace = new Date(NOW_MS - graceMin * 60_000).toISOString();
  assert.equal(
    derive({
      bookingStatus: "scheduled",
      startAtIso: startAtGrace,
      runningLateGraceMinutes: graceMin,
    }),
    "running_late"
  );
  // One ms before grace ends → not late
  const notLateStart = new Date(NOW_MS - graceMin * 60_000 + 1).toISOString();
  assert.equal(
    derive({
      bookingStatus: "confirmed",
      startAtIso: notLateStart,
      runningLateGraceMinutes: graceMin,
    }),
    "expected"
  );
  // Explicit zero-grace override still works
  assert.equal(
    derive({
      bookingStatus: "scheduled",
      startAtIso: NOW_ISO,
      runningLateGraceMinutes: 0,
    }),
    "running_late"
  );
});

test("13. stable ordering for equal start times uses booking id", () => {
  const a = { startAtIso: "2026-07-11T13:00:00.000Z", bookingId: "b-2" };
  const b = { startAtIso: "2026-07-11T13:00:00.000Z", bookingId: "b-1" };
  assert.equal(compareReceptionLaneItems(a, b), 1);
  assert.equal(compareReceptionLaneItems(b, a), -1);
  const sorted = sortReceptionLaneItems([a, b]);
  assert.deepEqual(
    sorted.map((x) => x.bookingId),
    ["b-1", "b-2"]
  );
});

test("13b. ordering prefers earlier start, invalid starts last", () => {
  const items = [
    { startAtIso: "2026-07-11T14:00:00.000Z", bookingId: "c" },
    { startAtIso: null, bookingId: "z-missing" },
    { startAtIso: "2026-07-11T12:00:00.000Z", bookingId: "a" },
    { startAtIso: "bad", bookingId: "y-bad" },
  ];
  const sorted = sortReceptionLaneItems(items);
  assert.deepEqual(
    sorted.map((x) => x.bookingId),
    ["a", "c", "y-bad", "z-missing"]
  );
});

test("14. identical input produces identical output", () => {
  const input = {
    bookingStatus: "scheduled",
    startAtIso: "2026-07-11T12:20:00.000Z",
    metadata: {},
    nowMs: NOW_MS,
  };
  const a = deriveReceptionOperationalState(input);
  const b = deriveReceptionOperationalState(input);
  assert.equal(a, b);
  assert.equal(a, "arriving_soon");
});

test("15. legacy column mapping remains compatible", () => {
  // Time-aware states collapse into expected for legacy columns
  assert.equal(receptionBoardColumnFromOperationalState("arriving_soon"), "expected");
  assert.equal(receptionBoardColumnFromOperationalState("running_late"), "expected");
  assert.equal(receptionBoardColumnFromOperationalState("waiting"), "arrived");
  assert.equal(receptionBoardColumnFromOperationalState("in_consultation"), "in_consultation");
  // Time-agnostic path still matches historical tests
  assert.equal(
    receptionBoardColumnForBooking({ booking_status: "arrived", metadata: {} }),
    "arrived"
  );
  assert.equal(
    receptionBoardColumnForBooking({ booking_status: "scheduled", metadata: {} }),
    "expected"
  );
});

test("confirmed booking inside window is arriving_soon like scheduled", () => {
  assert.equal(
    derive({ bookingStatus: "confirmed", startAtIso: "2026-07-11T12:45:00.000Z" }),
    "arriving_soon"
  );
});

test("treatment phase takes precedence over consultation-looking timestamps", () => {
  assert.equal(
    derive({
      bookingStatus: "arrived",
      startAtIso: NOW_ISO,
      metadata: { [FI_RECEPTION_FLOW_PHASE_KEY]: "treatment" },
    }),
    "in_treatment"
  );
});

test("in_consultation is not waiting", () => {
  assert.equal(
    isBookingWaiting({
      bookingStatus: "arrived",
      metadata: { [FI_RECEPTION_FLOW_PHASE_KEY]: "consultation" },
    }),
    false
  );
});
