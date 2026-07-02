import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import {
  activeCalendarOsViewPresetId,
  calendarOsPresetPatch,
  calendarOsViewPresetById,
} from "./calendarViewPresets";

function query(overrides: Partial<ParsedCalendarQuery> = {}): ParsedCalendarQuery {
  return {
    view: "week",
    dateAnchor: "2026-06-10",
    calendarTimezone: "UTC",
    status: null,
    bookingType: null,
    assignedUserId: null,
    staffId: null,
    clinicId: null,
    roomId: null,
    resourceView: "staff",
    includeCancelled: false,
    search: null,
    sampleMode: false,
    staffRoleBucket: null,
    waitingOnly: false,
    unassignedOnly: false,
    ...overrides,
  };
}

describe("calendarViewPresets", () => {
  it("resolves surgery day preset", () => {
    const preset = calendarOsViewPresetById("surgery_day");
    assert.ok(preset);
    assert.equal(activeCalendarOsViewPresetId(query({ view: "day", bookingType: "surgery" })), "surgery_day");
  });

  it("resolves nursing preset from role bucket", () => {
    assert.equal(activeCalendarOsViewPresetId(query({ staffRoleBucket: "nurse" })), "nursing");
  });

  it("returns patch for rooms preset", () => {
    const patch = calendarOsPresetPatch("rooms");
    assert.equal(patch.resourceView, "room");
    assert.equal(patch.view, "day");
  });

  it("all resources clears filters", () => {
    assert.equal(
      activeCalendarOsViewPresetId(
        query({ view: "week", resourceView: "staff", bookingType: null, staffRoleBucket: null })
      ),
      "all_resources"
    );
  });
});
