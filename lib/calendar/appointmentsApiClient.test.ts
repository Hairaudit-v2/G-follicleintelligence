import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { rescheduleCalendarAppointmentRequest } from "./appointmentsApiClient";

const AID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("rescheduleCalendarAppointmentRequest", () => {
  it("maps fetch rejection to ok: false", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => {
      throw new Error("offline");
    }) as typeof fetch;
    try {
      const r = await rescheduleCalendarAppointmentRequest({
        tenantId: "evolved",
        appointmentId: AID,
        startAt: "2026-06-10T01:00:00.000Z",
        endAt: "2026-06-10T02:00:00.000Z",
      });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.error, "offline");
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("parses 409 with conflicting id", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({
        ok: false,
        error: "Slot taken",
        conflictingAppointmentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    })) as unknown as typeof fetch;
    try {
      const r = await rescheduleCalendarAppointmentRequest({
        tenantId: "evolved",
        appointmentId: AID,
        startAt: "2026-06-10T01:00:00.000Z",
        endAt: "2026-06-10T02:00:00.000Z",
      });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.isConflict, true);
        assert.equal(r.conflictingAppointmentId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        assert.equal(r.error, "Slot taken");
      }
    } finally {
      globalThis.fetch = orig;
    }
  });
});
