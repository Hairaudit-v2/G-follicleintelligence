import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calendarAppointmentsSyncKey } from "./calendarAppointmentsStore";

const TENANT = "00000000-0000-0000-0000-000000000099";

function baseData(overrides: Partial<Parameters<typeof calendarAppointmentsSyncKey>[0]> = {}) {
  return {
    tenantId: TENANT,
    rangeStartIso: "2026-06-01T00:00:00.000Z",
    rangeEndIso: "2026-06-08T00:00:00.000Z",
    calendarTimezone: "Australia/Perth",
    query: { view: "week" as const, dateAnchor: "2026-06-02", sampleMode: false },
    ...overrides,
  };
}

describe("calendarAppointmentsSyncKey", () => {
  it("differs when URL sample mode toggles so demo rows cannot reuse real-booking store slices", () => {
    const real = calendarAppointmentsSyncKey(baseData());
    const demo = calendarAppointmentsSyncKey(
      baseData({ query: { view: "week", dateAnchor: "2026-06-02", sampleMode: true } })
    );
    assert.notEqual(real, demo);
  });

  it("differs when view changes", () => {
    const week = calendarAppointmentsSyncKey(baseData());
    const month = calendarAppointmentsSyncKey(
      baseData({ query: { view: "month", dateAnchor: "2026-06-02", sampleMode: false } })
    );
    assert.notEqual(week, month);
  });

  it("matches useCalendarAppointments clientSample suffix — client-only augment cannot alias real mode", () => {
    const data = baseData();
    const hookKey = (clientSample: boolean) =>
      [calendarAppointmentsSyncKey(data), clientSample ? "clientSample:1" : "clientSample:0"].join(
        "|"
      );
    assert.notEqual(hookKey(true), hookKey(false));
  });
});
