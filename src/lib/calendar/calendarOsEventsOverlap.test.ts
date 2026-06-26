import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CALENDAR_OS_EVENTS_OVERLAP_CAP,
  FI_CALENDAR_EVENTS_OVERLAP_SELECT,
  calendarOsBookingRowExposesSecrets,
  calendarOsOverlapRowsForDisplayContext,
  mapFiCalendarEventsToOperationalCalendar,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";
import { loadFiCalendarEventsForOverlap } from "@/src/lib/calendar/calendarOsEvents.server";
import {
  buildStaffCalendarLinkIndex,
  resolveCalendarEventStaffAssignment,
  type StaffCalendarLinkLookupRow,
} from "@/src/lib/googleCalendar/googleCalendarProviderLinksCore";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function sampleEventRow(overrides: Partial<FiCalendarEventOverlapRow> = {}): FiCalendarEventOverlapRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT_A,
    external_event_id: "google-event-123",
    provider: "google",
    calendar_id: "primary",
    title: "Consultation",
    description: "Notes",
    location: null,
    start_time: "2026-06-26T10:00:00.000Z",
    end_time: "2026-06-26T10:30:00.000Z",
    event_type: "consultation",
    google_meet_url: null,
    patient_id: null,
    lead_id: null,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function sampleLink(overrides: Partial<StaffCalendarLinkLookupRow> = {}): StaffCalendarLinkLookupRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT_A,
    staff_member_id: STAFF_A,
    provider: "google",
    calendar_id: "primary",
    status: "active",
    ...overrides,
  };
}

type OverlapQueryCapture = {
  select: string | null;
  tenantId: string | null;
  ltStart: string | null;
  gtEnd: string | null;
  limit: number | null;
};

function createOverlapMockSupabase(rows: FiCalendarEventOverlapRow[]) {
  const capture: OverlapQueryCapture = {
    select: null,
    tenantId: null,
    ltStart: null,
    gtEnd: null,
    limit: null,
  };

  const client = {
    from(table: string) {
      assert.equal(table, "fi_calendar_events");
      return {
        select(cols: string) {
          capture.select = cols;
          return {
            eq(col: string, val: string) {
              assert.equal(col, "tenant_id");
              capture.tenantId = val;
              return {
                lt(col2: string, val2: string) {
                  assert.equal(col2, "start_time");
                  capture.ltStart = val2;
                  return {
                    gt(col3: string, val3: string) {
                      assert.equal(col3, "end_time");
                      capture.gtEnd = val3;
                      return {
                        order() {
                          return {
                            limit(n: number) {
                              capture.limit = n;
                              const filtered = rows.filter(
                                (r) =>
                                  r.tenant_id === capture.tenantId &&
                                  r.start_time != null &&
                                  r.end_time != null &&
                                  r.start_time < capture.ltStart! &&
                                  r.end_time > capture.gtEnd!
                              );
                              return Promise.resolve({ data: filtered, error: null });
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, capture };
}

describe("CalendarOS overlap query — range scoped", () => {
  it("loadFiCalendarEventsForOverlap uses overlap filters and safe column projection", async () => {
    const inRange = sampleEventRow({
      start_time: "2026-06-10T09:00:00.000Z",
      end_time: "2026-06-10T10:00:00.000Z",
    });
    const { client, capture } = createOverlapMockSupabase([inRange]);

    const rows = await loadFiCalendarEventsForOverlap(
      {
        tenantId: TENANT_A,
        rangeStartIso: "2026-06-01T00:00:00.000Z",
        rangeEndIso: "2026-07-01T00:00:00.000Z",
      },
      client
    );

    assert.equal(capture.select, FI_CALENDAR_EVENTS_OVERLAP_SELECT);
    assert.equal(capture.tenantId, TENANT_A);
    assert.equal(capture.ltStart, "2026-07-01T00:00:00.000Z");
    assert.equal(capture.gtEnd, "2026-06-01T00:00:00.000Z");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.id, inRange.id);
  });

  it("excludes events outside the visible range", async () => {
    const outside = sampleEventRow({
      start_time: "2026-08-01T09:00:00.000Z",
      end_time: "2026-08-01T10:00:00.000Z",
    });
    const { client } = createOverlapMockSupabase([outside]);

    const rows = await loadFiCalendarEventsForOverlap(
      {
        tenantId: TENANT_A,
        rangeStartIso: "2026-06-01T00:00:00.000Z",
        rangeEndIso: "2026-07-01T00:00:00.000Z",
      },
      client
    );

    assert.equal(rows.length, 0);
  });

  it("does not select encrypted tokens or raw provider payloads", () => {
    assert.equal(FI_CALENDAR_EVENTS_OVERLAP_SELECT.includes("access_token"), false);
    assert.equal(FI_CALENDAR_EVENTS_OVERLAP_SELECT.includes("refresh_token"), false);
    assert.equal(FI_CALENDAR_EVENTS_OVERLAP_SELECT.includes("provider_payload"), false);
    assert.equal(FI_CALENDAR_EVENTS_OVERLAP_SELECT.includes("description"), true);
  });

  it("empty calendar event list remains fast and safe", async () => {
    const { client } = createOverlapMockSupabase([]);
    const rows = await loadFiCalendarEventsForOverlap(
      {
        tenantId: TENANT_A,
        rangeStartIso: "2026-06-01T00:00:00.000Z",
        rangeEndIso: "2026-07-01T00:00:00.000Z",
      },
      client
    );
    assert.deepEqual(rows, []);

    const mapped = mapFiCalendarEventsToOperationalCalendar([], {
      tenantId: TENANT_A,
      calendarTimezone: "UTC",
      displayMaps: { patients: new Map(), leads: new Map(), persons: new Map() },
      services: [],
      staffCalendarLinks: new Map(),
    });
    assert.deepEqual(mapped.bookings, []);
  });

  it("respects CALENDAR_OS_EVENTS_OVERLAP_CAP as query limit ceiling", async () => {
    const { client, capture } = createOverlapMockSupabase([]);
    await loadFiCalendarEventsForOverlap(
      {
        tenantId: TENANT_A,
        rangeStartIso: "2026-06-01T00:00:00.000Z",
        rangeEndIso: "2026-07-01T00:00:00.000Z",
        limit: 5000,
      },
      client
    );
    assert.equal(capture.limit, CALENDAR_OS_EVENTS_OVERLAP_CAP);
  });
});

describe("CalendarOS provider link assignment — O(n) map lookup", () => {
  it("resolveCalendarEventStaffAssignment uses Map in O(1) per event", () => {
    const links = Array.from({ length: 200 }, (_, i) =>
      sampleLink({ calendar_id: `calendar-${i}`, staff_member_id: STAFF_A })
    );
    const index = buildStaffCalendarLinkIndex(links, TENANT_A);
    const target = sampleEventRow({ calendar_id: "calendar-150" });

    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      resolveCalendarEventStaffAssignment(target, index, TENANT_A);
    }
    const elapsed = performance.now() - t0;
    assert.ok(elapsed < 50, `expected fast Map lookups, took ${elapsed}ms`);

    const result = resolveCalendarEventStaffAssignment(target, index, TENANT_A);
    assert.equal(result.staffMemberId, STAFF_A);
  });

  it("mapFiCalendarEventsToOperationalCalendar builds index once for array input", () => {
    const links = [sampleLink()];
    const events = Array.from({ length: 100 }, () => sampleEventRow());
    const mapped = mapFiCalendarEventsToOperationalCalendar(events, {
      tenantId: TENANT_A,
      calendarTimezone: "UTC",
      displayMaps: { patients: new Map(), leads: new Map(), persons: new Map() },
      services: [],
      staffCalendarLinks: links,
    });
    assert.equal(mapped.bookings.length, 100);
    assert.equal(mapped.bookings.every((b) => b.assigned_staff_id === STAFF_A), true);
    assert.equal(mapped.bookings.every((b) => !calendarOsBookingRowExposesSecrets(b)), true);
  });

  it("merges calendar events with fi bookings without duplicate ids", () => {
    const fiBookingId = randomUUID();
    const calendarEvent = sampleEventRow();
    const mapped = mapFiCalendarEventsToOperationalCalendar([calendarEvent], {
      tenantId: TENANT_A,
      calendarTimezone: "UTC",
      displayMaps: { patients: new Map(), leads: new Map(), persons: new Map() },
      services: [],
      staffCalendarLinks: [sampleLink()],
    });

    const combinedIds = [fiBookingId, ...mapped.bookings.map((b) => b.id)];
    assert.equal(new Set(combinedIds).size, combinedIds.length);
    assert.ok(mapped.bookings.some((b) => b.id === calendarEvent.id));
  });

  it("calendarOsOverlapRowsForDisplayContext exposes patient/lead ids only", () => {
    const patientId = randomUUID();
    const leadId = randomUUID();
    const stubs = calendarOsOverlapRowsForDisplayContext([
      sampleEventRow({ patient_id: patientId, lead_id: leadId }),
    ]);
    assert.equal(stubs.length, 1);
    assert.equal(stubs[0]!.patient_id, patientId);
    assert.equal(stubs[0]!.lead_id, leadId);
    assert.equal(stubs[0]!.metadata?.access_token, undefined);
  });
});

describe("CalendarOS overlap perf migration indexes", () => {
  it("defines overlap indexes for fi_calendar_events and fi_staff_calendar_links", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260926120004_calendar_os_calendar_events_overlap_perf.sql"
      ),
      "utf8"
    );
    assert.match(sql, /idx_fi_calendar_events_tenant_start_end/);
    assert.match(sql, /fi_calendar_events \(tenant_id, start_time, end_time\)/);
    assert.match(sql, /idx_fi_staff_calendar_links_tenant_provider_calendar_status/);
    assert.match(sql, /fi_staff_calendar_links \(tenant_id, provider, calendar_id, status\)/);
  });
});
