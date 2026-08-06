/**
 * Pure booking-slot gate decisions — mirrors server assert composition without I/O.
 * Server assert loads staff + blocks then applies this contract.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  BLOCKING_AVAILABILITY_BLOCK_TYPES,
  formatStaffWeeklyHoursSummary,
  getStaffAvailabilityForRange,
  parseStaffWeeklyHours,
  serializeStaffWeeklyHours,
  type StaffAvailabilityBlockRecord,
} from "@/src/lib/team/roster/availability";

const START = "2026-06-08T00:30:00.000Z";
const END = "2026-06-08T01:30:00.000Z";

function weeklyDoc() {
  return serializeStaffWeeklyHours({
    mon: { enabled: true, start: "08:30", end: "17:30" },
    tue: { enabled: true, start: "08:30", end: "17:30" },
    wed: { enabled: true, start: "08:30", end: "17:30" },
    thu: { enabled: true, start: "08:30", end: "17:30" },
    fri: { enabled: true, start: "08:30", end: "17:30" },
    sat: { enabled: false },
    sun: { enabled: false },
  }) as Record<string, unknown>;
}

function evaluateGate(input: {
  workingHours: Record<string, unknown>;
  blocks: StaffAvailabilityBlockRecord[];
  startIso?: string;
  endIso?: string;
}): { allowed: boolean; denyKind: "leave" | "weekly" | "empty" | null } {
  const startIso = input.startIso ?? START;
  const endIso = input.endIso ?? END;
  const effective = getStaffAvailabilityForRange({
    staffId: "s1",
    startsAt: startIso,
    endsAt: endIso,
    workingHours: input.workingHours,
    staffTimezone: "Australia/Perth",
    availabilityBlocks: input.blocks,
    shifts: [],
  });
  const hasOverride = effective.activeBlocks.some((b) => b.block_type === "available_override");
  const blocking = effective.activeBlocks.filter((b) =>
    (BLOCKING_AVAILABILITY_BLOCK_TYPES as readonly string[]).includes(b.block_type)
  );
  if (blocking.length > 0) return { allowed: false, denyKind: "leave" };
  const summary = formatStaffWeeklyHoursSummary(
    parseStaffWeeklyHours(input.workingHours)
  ).trim();
  if (!summary && !hasOverride) {
    return { allowed: false, denyKind: "empty" };
  }
  if (!effective.available) return { allowed: false, denyKind: "weekly" };
  return { allowed: true, denyKind: null };
}

test("booking gate: leave block denies even inside weekly hours", () => {
  const r = evaluateGate({
    workingHours: weeklyDoc(),
    blocks: [
      {
        id: "1",
        block_type: "leave",
        starts_at: START,
        ends_at: END,
        status: "active",
      },
    ],
  });
  assert.equal(r.allowed, false);
  assert.equal(r.denyKind, "leave");
});

test("booking gate: available_override allows outside weekly template", () => {
  // Sunday 10:00–11:00 AWST — weekly template has Sunday closed.
  const r = evaluateGate({
    workingHours: weeklyDoc(),
    startIso: "2026-06-07T02:00:00.000Z",
    endIso: "2026-06-07T03:00:00.000Z",
    blocks: [
      {
        id: "ov",
        block_type: "available_override",
        starts_at: "2026-06-07T01:00:00.000Z",
        ends_at: "2026-06-07T04:00:00.000Z",
        status: "active",
      },
    ],
  });
  assert.equal(r.allowed, true);
});

test("booking gate: outside weekly without override denies", () => {
  const r = evaluateGate({
    workingHours: weeklyDoc(),
    startIso: "2026-06-07T02:00:00.000Z",
    endIso: "2026-06-07T03:00:00.000Z",
    blocks: [],
  });
  assert.equal(r.allowed, false);
  assert.equal(r.denyKind, "weekly");
});

test("booking gate: empty weekly without override denies", () => {
  const r = evaluateGate({
    workingHours: {},
    blocks: [],
  });
  assert.equal(r.allowed, false);
  assert.ok(r.denyKind === "empty" || r.denyKind === "weekly");
});

test("booking gate: empty weekly with override allows", () => {
  const r = evaluateGate({
    workingHours: {},
    blocks: [
      {
        id: "ov",
        block_type: "available_override",
        starts_at: START,
        ends_at: END,
        status: "active",
      },
    ],
  });
  assert.equal(r.allowed, true);
});
