import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildInboundScopePageStats,
  inboundSyncCalendarRowToClient,
} from "./googleCalendarInboundScopeCore";

describe("googleCalendarInboundScopeCore", () => {
  it("maps DB row to client row with metadata fields", () => {
    const client = inboundSyncCalendarRowToClient({
      id: "row-1",
      google_calendar_id: "cal@group.calendar.google.com",
      google_calendar_summary: "Holidays in Australia",
      is_enabled: false,
      is_primary: false,
      last_synced_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-02T00:00:00.000Z",
      metadata: { accessRole: "reader", timeZone: "Australia/Sydney" },
    });

    assert.equal(client.summary, "Holidays in Australia");
    assert.equal(client.googleCalendarId, "cal@group.calendar.google.com");
    assert.equal(client.isEnabled, false);
    assert.equal(client.accessRole, "reader");
    assert.equal(client.timeZone, "Australia/Sydney");
  });

  it("builds stats from calendars and integration", () => {
    const stats = buildInboundScopePageStats(
      [
        {
          id: "a",
          summary: "Primary",
          googleCalendarId: "primary",
          isEnabled: true,
          isPrimary: true,
          accessRole: "owner",
          timeZone: "UTC",
          lastSyncedAt: "2026-06-10T12:00:00.000Z",
          updatedAt: "2026-06-10T12:00:00.000Z",
        },
        {
          id: "b",
          summary: "Holidays",
          googleCalendarId: "holiday@group.calendar.google.com",
          isEnabled: false,
          isPrimary: false,
          accessRole: "reader",
          timeZone: "Australia/Sydney",
          lastSyncedAt: null,
          updatedAt: "2026-06-09T12:00:00.000Z",
        },
      ],
      {
        lastSyncedAt: "2026-06-08T00:00:00.000Z",
        lastSyncStatus: "success",
        lastSyncErrorSummary: null,
      }
    );

    assert.equal(stats.calendarsDiscovered, 2);
    assert.equal(stats.calendarsEnabled, 1);
    assert.equal(stats.lastSyncAt, "2026-06-10T12:00:00.000Z");
    assert.equal(stats.lastSyncResult?.status, "success");
  });
});
