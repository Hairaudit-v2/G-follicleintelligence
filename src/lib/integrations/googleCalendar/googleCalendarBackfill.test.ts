import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  buildGoogleCalendarBackfillDiagnosticsPatch,
  detectGoogleCalendarExternalSource,
  looksLikeGoogleCalendarAppointment,
  matchPatientByEventTitle,
  parseGoogleCalendarBackfillDiagnostics,
  resolveGoogleCalendarBackfillDateRange,
  resolveGoogleCalendarBackfillNextDaysRange,
} from "@/src/lib/integrations/googleCalendar/googleCalendarBackfillCore";
import {
  markGoogleCalendarLinkedBookingCancelled,
  runGoogleCalendarBackfill,
} from "@/src/lib/integrations/googleCalendar/googleCalendarBackfill.server";
import { createGoogleCalendarBackfillTestMock } from "@/src/lib/integrations/googleCalendar/googleCalendarBackfillTestMock";
import { syncGoogleCalendarEvents } from "@/src/lib/googleCalendar/googleCalendarService.server";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INTEGRATION_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MASTER_KEY = "gc-backfill-test-master-key";
const PERTH = "Australia/Perth";

function googleEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "evt-1",
    status: overrides.status ?? "confirmed",
    summary: overrides.summary ?? "Aaron Diehl",
    description: overrides.description ?? "",
    start: overrides.start ?? { dateTime: "2026-07-07T01:00:00+08:00" },
    end: overrides.end ?? { dateTime: "2026-07-07T02:00:00+08:00" },
    updated: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function createFetchOverride(events: ReturnType<typeof googleEvent>[]) {
  return async () =>
    new Response(JSON.stringify({ items: events }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}

describe("googleCalendarBackfillCore", () => {
  it("resolves July 2026 range in Australia/Perth", () => {
    const range = resolveGoogleCalendarBackfillDateRange({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      timeZone: PERTH,
      now: new Date("2026-07-03T02:00:00.000Z"),
    });
    assert.ok(!("error" in range));
    if ("error" in range) return;
    assert.equal(range.rangeStart, "2026-07-01");
    assert.equal(range.rangeEnd, "2026-07-31");
    assert.ok(range.timeMin < range.timeMax);
  });

  it("resolves next 14 days from today in Perth", () => {
    const now = new Date("2026-07-03T02:00:00.000Z");
    const range = resolveGoogleCalendarBackfillNextDaysRange(14, PERTH, now);
    assert.ok(!("error" in range));
    if ("error" in range) return;
    assert.equal(range.rangeStart, "2026-07-03");
    assert.equal(range.rangeEnd, "2026-07-16");
  });

  it("detects timely_via_google from description", () => {
    const source = detectGoogleCalendarExternalSource(
      googleEvent({ description: "Booked via Timely appointment system" }) as never
    );
    assert.equal(source, "timely_via_google");
  });

  it("classifies patient-name timed events as appointments", () => {
    assert.equal(looksLikeGoogleCalendarAppointment(googleEvent() as never), true);
    assert.equal(
      looksLikeGoogleCalendarAppointment(googleEvent({ summary: "Out of office" }) as never),
      false
    );
  });

  it("matches patient by title conservatively", () => {
    const matched = matchPatientByEventTitle("Aaron Diehl", [
      {
        patientId: "p1",
        personId: "person-1",
        displayName: "Aaron Diehl",
        leadId: "lead-1",
      },
    ]);
    assert.equal(matched.status, "matched");
    assert.equal(matched.patientId, "p1");

    const ambiguous = matchPatientByEventTitle("Aaron Diehl", [
      {
        patientId: "p1",
        personId: "person-1",
        displayName: "Aaron Diehl",
      },
      {
        patientId: "p2",
        personId: "person-2",
        displayName: "Aaron Diehl",
      },
    ]);
    assert.equal(ambiguous.status, "ambiguous");
  });

  it("parses backfill diagnostics from sync health metadata", () => {
    const patch = buildGoogleCalendarBackfillDiagnosticsPatch({
      rangeStart: "2026-07-01",
      rangeEnd: "2026-07-31",
      importedCount: 12,
      reviewCount: 2,
      warnings: ["partial failure"],
      now: new Date("2026-07-03T12:00:00.000Z"),
    });
    const parsed = parseGoogleCalendarBackfillDiagnostics(patch);
    assert.equal(parsed.googleCalendarBackfillImportedCount, 12);
    assert.equal(parsed.googleCalendarBackfillReviewCount, 2);
    assert.equal(parsed.warnings.length, 1);
  });
});

describe("googleCalendarBackfill.server", () => {
  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://example.com/callback";
  });

  afterEach(() => {
    delete process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY;
  });

  it("dry run finds source events without writing", async () => {
    const mock = createGoogleCalendarBackfillTestMock({
      tenantId: TENANT_A,
      integrationId: INTEGRATION_A,
      masterKey: MASTER_KEY,
    });
    const result = await runGoogleCalendarBackfill(
      {
        tenantId: TENANT_A,
        startDate: "2026-07-07",
        endDate: "2026-07-09",
        dryRun: true,
        promoteSafeBookings: false,
        skipRevalidation: true,
      },
      {
        supabaseClientForTests: mock.client,
        fetchOverride: createFetchOverride([googleEvent({ id: "evt-dry-1" })]),
        now: new Date("2026-07-03T02:00:00.000Z"),
      }
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.dryRun, true);
    assert.equal(result.summary.sourceEventsFound, 1);
    assert.equal(result.summary.toCreate, 1);
    assert.equal(mock.events.length, 0);
  });

  it("import creates fi_calendar_events and is idempotent on repeat", async () => {
    const mock = createGoogleCalendarBackfillTestMock({
      tenantId: TENANT_A,
      integrationId: INTEGRATION_A,
      masterKey: MASTER_KEY,
    });
    const fetchOverride = createFetchOverride([googleEvent({ id: "evt-stable-import" })]);

    const first = await runGoogleCalendarBackfill(
      {
        tenantId: TENANT_A,
        startDate: "2026-07-07",
        endDate: "2026-07-09",
        dryRun: false,
        promoteSafeBookings: false,
        skipRevalidation: true,
      },
      {
        supabaseClientForTests: mock.client,
        fetchOverride,
        now: new Date("2026-07-03T02:00:00.000Z"),
      }
    );
    assert.equal(first.ok, true);
    assert.equal(mock.events.length, 1);

    const second = await runGoogleCalendarBackfill(
      {
        tenantId: TENANT_A,
        startDate: "2026-07-07",
        endDate: "2026-07-09",
        dryRun: false,
        promoteSafeBookings: false,
        skipRevalidation: true,
      },
      {
        supabaseClientForTests: mock.client,
        fetchOverride,
        now: new Date("2026-07-03T02:00:00.000Z"),
      }
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(mock.events.length, 1);
    assert.ok(second.summary.alreadyImported >= 0 || second.summary.toCreate === 0);
  });

  it("changed Google event updates existing FI calendar event", async () => {
    const mock = createGoogleCalendarBackfillTestMock({
      tenantId: TENANT_A,
      integrationId: INTEGRATION_A,
      masterKey: MASTER_KEY,
    });
    let version = 0;
    const fetchOverride: typeof fetch = async () => {
      version += 1;
      return new Response(
        JSON.stringify({
          items: [
            googleEvent({
              id: "evt-stable",
              summary: version === 1 ? "Aaron Diehl" : "Aaron Diehl (rescheduled)",
              updated: version === 1 ? "2026-07-01T00:00:00Z" : "2026-07-08T00:00:00Z",
            }),
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    await syncGoogleCalendarEvents(TENANT_A, {
      supabaseClientForTests: mock.client,
      fetchOverride,
      integrationId: INTEGRATION_A,
      timeMin: "2026-07-06T16:00:00.000Z",
      timeMax: "2026-07-10T16:00:00.000Z",
    });
    assert.equal(mock.events.length, 1);
    assert.equal(mock.events[0]!.title, "Aaron Diehl");

    await syncGoogleCalendarEvents(TENANT_A, {
      supabaseClientForTests: mock.client,
      fetchOverride,
      integrationId: INTEGRATION_A,
      timeMin: "2026-07-06T16:00:00.000Z",
      timeMax: "2026-07-10T16:00:00.000Z",
    });
    assert.equal(mock.events.length, 1);
    assert.equal(mock.events[0]!.title, "Aaron Diehl (rescheduled)");
  });

  it("cancelled Google event marks linked booking cancelled", async () => {
    const mock = createGoogleCalendarBackfillTestMock({
      tenantId: TENANT_A,
      integrationId: INTEGRATION_A,
      masterKey: MASTER_KEY,
    });
    mock.mappings.push({
      id: randomUUID(),
      tenant_id: TENANT_A,
      source_system: "google_calendar",
      entity_type: "booking",
      external_id: "evt-cancel",
      internal_id: "booking-1",
    });
    mock.bookings.push({
      id: "booking-1",
      tenant_id: TENANT_A,
      booking_status: "scheduled",
      title: "Aaron Diehl",
      start_at: "2026-07-07T01:00:00.000Z",
      end_at: "2026-07-07T02:00:00.000Z",
    });

    const cancelled = await markGoogleCalendarLinkedBookingCancelled(
      mock.client,
      TENANT_A,
      "evt-cancel",
      false
    );
    assert.equal(cancelled, true);
    assert.equal(mock.bookings[0]!.booking_status, "cancelled");
  });

  it("enforces tenant isolation", async () => {
    const mock = createGoogleCalendarBackfillTestMock({
      tenantId: TENANT_A,
      integrationId: INTEGRATION_A,
      masterKey: MASTER_KEY,
    });
    const result = await runGoogleCalendarBackfill(
      {
        tenantId: TENANT_B,
        startDate: "2026-07-07",
        endDate: "2026-07-09",
        dryRun: true,
        skipRevalidation: true,
      },
      {
        supabaseClientForTests: mock.client,
        fetchOverride: createFetchOverride([]),
        now: new Date("2026-07-03T02:00:00.000Z"),
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /No active Google Calendar integration/i);
  });
});
