import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapFiCalendarEventOverlapRowToBookingRow,
  mapFiCalendarEventsToOperationalCalendar,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  decryptExternalConnectorSecret,
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
} from "@/src/lib/onboarding-os/externalConnectorSecretCrypto.server";
import {
  buildStaffCalendarLinkIndex,
  findStaffForCalendarEvent,
  maskTimelyIcsUrlForDisplay,
  resolveCalendarEventStaffAssignment,
  staffCalendarLinkClientPayloadExposesSecrets,
  staffCalendarLinkToClientRow,
  type StaffCalendarLinkLookupRow,
} from "@/src/lib/googleCalendar/googleCalendarProviderLinksCore";
import {
  createStaffCalendarLink,
  deactivateStaffCalendarLink,
  loadStaffCalendarLinks,
} from "@/src/lib/googleCalendar/googleCalendarProviderLinksData";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STAFF_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STAFF_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MASTER_KEY = "gc6-test-master-key-16";

type LinkRow = Record<string, unknown>;
type StaffRow = Record<string, unknown>;

function sampleEventRow(overrides: Partial<FiCalendarEventOverlapRow> = {}): FiCalendarEventOverlapRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT_A,
    external_event_id: "google-event-123",
    provider: "google",
    calendar_id: "primary",
    title: "Consultation",
    description: null,
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

function createMockSupabase() {
  const links: LinkRow[] = [];
  const staff: StaffRow[] = [
    { id: STAFF_A, tenant_id: TENANT_A, full_name: "Dr Alice" },
    { id: STAFF_B, tenant_id: TENANT_A, full_name: "Dr Bob" },
  ];

  const client = {
    from(table: string) {
      if (table === "fi_staff_calendar_links") {
        return {
          upsert(row: LinkRow, _opts?: { onConflict?: string }) {
            const tenantId = String(row.tenant_id);
            const provider = String(row.provider ?? "google");
            const calendarId = String(row.calendar_id);
            const idx = links.findIndex(
              (r) =>
                r.tenant_id === tenantId &&
                r.provider === provider &&
                r.calendar_id === calendarId
            );
            const id = idx >= 0 ? links[idx]!.id : randomUUID();
            const full = {
              ...row,
              id,
              status: row.status ?? "active",
              metadata: row.metadata ?? {},
              source_system: row.source_system ?? "google_calendar",
              created_at: row.created_at ?? new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            if (idx >= 0) links[idx] = full;
            else links.push(full);
            return {
              select() {
                return { single: async () => ({ data: full, error: null }) };
              },
            };
          },
          select(_cols?: string) {
            return {
              eq(col: string, val: string) {
                const chain = {
                  eq(col2: string, val2: string) {
                    return {
                      order(_col: string, _opts?: { ascending?: boolean }) {
                        return {
                          async then(resolve: (v: unknown) => void) {
                            const filtered = links.filter(
                              (r) => r[col] === val && r[col2] === val2
                            );
                            resolve({ data: filtered, error: null });
                          },
                        };
                      },
                    };
                  },
                  order(_col: string, _opts?: { ascending?: boolean }) {
                    return {
                      async then(resolve: (v: unknown) => void) {
                        const filtered = links.filter((r) => r[col] === val);
                        resolve({ data: filtered, error: null });
                      },
                    };
                  },
                  maybeSingle: async () => {
                    const row = links.find((r) => r[col] === val);
                    return { data: row ?? null, error: null };
                  },
                  in(_col2: string, _vals: string[]) {
                    return chain;
                  },
                };
                return chain;
              },
            };
          },
          update(patch: LinkRow) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    return {
                      select() {
                        return {
                          single: async () => {
                            const row = links.find((r) => r[col] === val && r[col2] === val2);
                            if (!row) return { data: null, error: { message: "not found" } };
                            Object.assign(row, patch, { updated_at: new Date().toISOString() });
                            return { data: row, error: null };
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
      }

      if (table === "fi_staff") {
        return {
          select(_cols?: string) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string | boolean) {
                    return {
                      order() {
                        return {
                          async then(resolve: (v: unknown) => void) {
                            const filtered = staff.filter(
                              (r) => r[col] === val && r[col2] === val2
                            );
                            resolve({ data: filtered, error: null });
                          },
                        };
                      },
                      maybeSingle: async () => {
                        const row = staff.find((r) => r[col] === val && r[col2] === val2);
                        return { data: row ?? null, error: null };
                      },
                      in(_col3: string, vals: string[]) {
                        return {
                          async then(resolve: (v: unknown) => void) {
                            const filtered = staff.filter(
                              (r) => r[col] === val && vals.includes(String(r.id))
                            );
                            resolve({ data: filtered, error: null });
                          },
                        };
                      },
                    };
                  },
                  in(_col2: string, vals: string[]) {
                    return {
                      async then(resolve: (v: unknown) => void) {
                        const filtered = staff.filter(
                          (r) => r[col] === val && vals.includes(String(r.id))
                        );
                        resolve({ data: filtered, error: null });
                      },
                    };
                  },
                  maybeSingle: async () => {
                    const row = staff.find((r) => r[col] === val);
                    return { data: row ?? null, error: null };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;

  return { client, links, staff };
}

describe("CalendarOS GC-6 — staff calendar links core", () => {
  it("active link assigns event to staff_member_id", () => {
    const links = [sampleLink()];
    const staffId = findStaffForCalendarEvent(
      { tenant_id: TENANT_A, provider: "google", calendar_id: "primary" },
      links
    );
    assert.equal(staffId, STAFF_A);
  });

  it("inactive link does not assign event", () => {
    const links = [sampleLink({ status: "inactive" })];
    const staffId = findStaffForCalendarEvent(
      { tenant_id: TENANT_A, provider: "google", calendar_id: "primary" },
      links
    );
    assert.equal(staffId, null);
  });

  it("unmatched calendar stays Unassigned", () => {
    const links = [sampleLink({ calendar_id: "other-calendar" })];
    const staffId = findStaffForCalendarEvent(
      { tenant_id: TENANT_A, provider: "google", calendar_id: "primary" },
      links
    );
    assert.equal(staffId, null);
  });

  it("resolveCalendarEventStaffAssignment returns link id when matched", () => {
    const link = sampleLink();
    const result = resolveCalendarEventStaffAssignment(
      { tenant_id: TENANT_A, provider: "google", calendar_id: "primary" },
      [link]
    );
    assert.equal(result.staffMemberId, STAFF_A);
    assert.equal(result.linkId, link.id);
  });

  it("buildStaffCalendarLinkIndex enforces tenant isolation", () => {
    const index = buildStaffCalendarLinkIndex(
      [
        sampleLink(),
        sampleLink({ tenant_id: TENANT_B, staff_member_id: STAFF_B, calendar_id: "other" }),
      ],
      TENANT_A
    );
    assert.equal(index.size, 1);
    assert.equal(index.get("google:primary")?.staff_member_id, STAFF_A);
  });

  it("masks Timely ICS URLs for display", () => {
    const masked = maskTimelyIcsUrlForDisplay(
      "https://timelyapp.com/calendar/feed/abc123secret456.ics"
    );
    assert.ok(masked);
    assert.equal(masked!.includes("abc123secret456"), false);
    assert.equal(masked!.includes("timelyapp.com"), true);
  });

  it("client payload never exposes encrypted ICS or raw URLs", () => {
    const clientRow = staffCalendarLinkToClientRow(
      {
        id: randomUUID(),
        staff_member_id: STAFF_A,
        provider: "timely",
        calendar_id: "timely-feed-1",
        calendar_label: "Alice Timely",
        google_account_email: null,
        timely_ics_url_encrypted: "encrypted-blob-here",
        source_system: "timely_ics",
        status: "active",
        created_at: "2026-06-01T00:00:00.000Z",
        updated_at: "2026-06-01T00:00:00.000Z",
      },
      "Dr Alice"
    );
    assert.equal(clientRow.timelyIcsConfigured, true);
    assert.ok(clientRow.timelyIcsMasked?.includes("••••"));
    assert.equal(staffCalendarLinkClientPayloadExposesSecrets(clientRow), false);
  });
});

describe("CalendarOS GC-6 — staff calendar links service", () => {
  const prevKey = process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY;

  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY;
    else process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = prevKey;
  });

  it("creates staff calendar link", async () => {
    const { client } = createMockSupabase();
    const link = await createStaffCalendarLink(
      {
        tenantId: TENANT_A,
        staffMemberId: STAFF_A,
        calendarId: "primary",
        calendarLabel: "Alice Google",
      },
      { supabaseClientForTests: client }
    );
    assert.equal(link.calendarId, "primary");
    assert.equal(link.staffMemberId, STAFF_A);
    assert.equal(link.status, "active");
  });

  it("duplicate tenant/provider/calendar_id upserts safely", async () => {
    const { client } = createMockSupabase();
    await createStaffCalendarLink(
      { tenantId: TENANT_A, staffMemberId: STAFF_A, calendarId: "primary" },
      { supabaseClientForTests: client }
    );
    const updated = await createStaffCalendarLink(
      { tenantId: TENANT_A, staffMemberId: STAFF_B, calendarId: "primary" },
      { supabaseClientForTests: client }
    );
    assert.equal(updated.staffMemberId, STAFF_B);
    const all = await loadStaffCalendarLinks(TENANT_A, {
      supabaseClientForTests: client,
      includeInactive: true,
    });
    assert.equal(all.length, 1);
  });

  it("encrypts Timely ICS URL and never exposes it in client rows", async () => {
    const { client, links } = createMockSupabase();
    const icsUrl = "https://timelyapp.com/calendar/feed/secret-feed-token.ics";
    const link = await createStaffCalendarLink(
      {
        tenantId: TENANT_A,
        staffMemberId: STAFF_A,
        calendarId: "timely-feed-1",
        provider: "timely",
        timelyIcsUrl: icsUrl,
      },
      { supabaseClientForTests: client }
    );
    assert.equal(link.timelyIcsConfigured, true);
    assert.equal(staffCalendarLinkClientPayloadExposesSecrets(link), false);

    const stored = links[0]!.timely_ics_url_encrypted as string;
    assert.ok(stored);
    assert.notEqual(stored, icsUrl);

    const key = deriveExternalConnectorMasterKey(MASTER_KEY)!;
    const decrypted = decryptExternalConnectorSecret(stored, key);
    assert.equal(decrypted, icsUrl);
  });

  it("deactivates link", async () => {
    const { client } = createMockSupabase();
    const created = await createStaffCalendarLink(
      { tenantId: TENANT_A, staffMemberId: STAFF_A, calendarId: "primary" },
      { supabaseClientForTests: client }
    );
    const deactivated = await deactivateStaffCalendarLink(TENANT_A, created.id, {
      supabaseClientForTests: client,
    });
    assert.equal(deactivated.status, "inactive");
    const activeOnly = await loadStaffCalendarLinks(TENANT_A, { supabaseClientForTests: client });
    assert.equal(activeOnly.length, 0);
  });

  it("loadStaffCalendarLinks filters by tenant", async () => {
    const { client } = createMockSupabase();
    await createStaffCalendarLink(
      { tenantId: TENANT_A, staffMemberId: STAFF_A, calendarId: "primary" },
      { supabaseClientForTests: client }
    );
    const tenantLinks = await loadStaffCalendarLinks(TENANT_B, { supabaseClientForTests: client });
    assert.equal(tenantLinks.length, 0);
  });
});

describe("CalendarOS GC-6 — loader staff column assignment", () => {
  it("places linked CalendarOS events into staff column", () => {
    const booking = mapFiCalendarEventOverlapRowToBookingRow(sampleEventRow(), "UTC", {
      staffMemberId: STAFF_A,
    });
    assert.equal(booking!.assigned_staff_id, STAFF_A);
  });

  it("leaves unlinked events unassigned", () => {
    const booking = mapFiCalendarEventOverlapRowToBookingRow(sampleEventRow(), "UTC");
    assert.equal(booking!.assigned_staff_id, null);
  });

  it("mapFiCalendarEventsToOperationalCalendar assigns via staff links", () => {
    const links = [sampleLink()];
    const mapped = mapFiCalendarEventsToOperationalCalendar([sampleEventRow()], {
      tenantId: TENANT_A,
      calendarTimezone: "UTC",
      displayMaps: { patients: new Map(), leads: new Map(), persons: new Map() },
      services: [],
      staffCalendarLinks: links,
    });
    assert.equal(mapped.bookings.length, 1);
    assert.equal(mapped.bookings[0]!.assigned_staff_id, STAFF_A);
  });

  it("existing fi_bookings behavior unchanged when merged with calendar events", () => {
    const existingBooking: FiBookingRow = {
      id: randomUUID(),
      tenant_id: TENANT_A,
      lead_id: null,
      person_id: null,
      patient_id: null,
      case_id: null,
      clinic_id: null,
      room_id: null,
      room_required: false,
      assigned_staff_id: STAFF_B,
      assigned_user_id: null,
      booking_type: "consultation",
      booking_status: "scheduled",
      title: "FI booking",
      description: null,
      start_at: "2026-06-26T11:00:00.000Z",
      end_at: "2026-06-26T11:30:00.000Z",
      timezone: "UTC",
      location: null,
      metadata: {},
      cancelled_at: null,
      cancelled_by_user_id: null,
      cancellation_reason: null,
      created_by_user_id: null,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    };

    const mapped = mapFiCalendarEventsToOperationalCalendar([sampleEventRow()], {
      tenantId: TENANT_A,
      calendarTimezone: "UTC",
      displayMaps: { patients: new Map(), leads: new Map(), persons: new Map() },
      services: [],
      staffCalendarLinks: [sampleLink()],
    });

    const combined = [existingBooking, ...mapped.bookings];
    assert.equal(combined.length, 2);
    assert.equal(combined[0]!.assigned_staff_id, STAFF_B);
    assert.equal(combined[1]!.assigned_staff_id, STAFF_A);
    assert.equal(combined[0]!.metadata?.calendar_os_event, undefined);
  });

  it("inactive link leaves calendar event unassigned in batch mapping", () => {
    const mapped = mapFiCalendarEventsToOperationalCalendar([sampleEventRow()], {
      tenantId: TENANT_A,
      calendarTimezone: "UTC",
      displayMaps: { patients: new Map(), leads: new Map(), persons: new Map() },
      services: [],
      staffCalendarLinks: [sampleLink({ status: "inactive" })],
    });
    assert.equal(mapped.bookings[0]!.assigned_staff_id, null);
  });
});

describe("CalendarOS GC-6 — encryption round-trip", () => {
  it("ICS URL encrypt/decrypt uses FI_EXTERNAL_CONNECTOR_MASTER_KEY", () => {
    const key = deriveExternalConnectorMasterKey(MASTER_KEY)!;
    const url = "https://timelyapp.com/calendar/feed/abc.ics";
    const enc = encryptExternalConnectorSecret(url, key);
    const dec = decryptExternalConnectorSecret(enc, key);
    assert.equal(dec, url);
    assert.equal(enc.includes("timelyapp"), false);
  });
});
