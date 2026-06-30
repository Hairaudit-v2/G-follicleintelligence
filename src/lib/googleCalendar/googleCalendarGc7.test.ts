import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  decryptExternalConnectorSecret,
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
} from "@/src/lib/onboarding-os/externalConnectorSecretCrypto.server";

import { storeGoogleCalendarCredentials } from "@/src/lib/googleCalendar/googleCalendarAuth.server";
import { mapGoogleApiEventToFiFields } from "@/src/lib/googleCalendar/googleCalendarCore";
import {
  detectGoogleCalendarSyncConflict,
  emptyReviewSyncCounters,
  incrementReviewCounter,
} from "@/src/lib/googleCalendar/googleCalendarSyncReviewCore";
import {
  dismissGoogleCalendarSyncReviewItem,
  importGoogleCalendarSyncReviewItem,
  linkGoogleCalendarSyncReviewItem,
  listGoogleCalendarSyncReviewItemsForTenant,
  upsertGoogleCalendarSyncReviewItem,
} from "@/src/lib/googleCalendar/googleCalendarSyncReview.server";
import { syncGoogleCalendarEvents } from "@/src/lib/googleCalendar/googleCalendarService.server";
import type { FiCalendarEvent } from "@/src/lib/googleCalendar/googleCalendarTypes";

const TENANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INTEGRATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CALENDAR = "primary";
const MASTER_KEY = "gc7-test-master-key";
const AUTH_USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FI_USER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

type EventRow = Record<string, unknown>;
type ReviewRow = Record<string, unknown>;

function baseLocalEvent(overrides: Partial<FiCalendarEvent> = {}): FiCalendarEvent {
  return {
    id: overrides.id ?? randomUUID(),
    tenantId: TENANT,
    externalEventId: overrides.externalEventId ?? "local-ext-1",
    provider: "google",
    calendarId: CALENDAR,
    title: overrides.title ?? "Existing consult",
    description: null,
    location: null,
    startTime: overrides.startTime ?? "2026-06-22T10:00:00.000Z",
    endTime: overrides.endTime ?? "2026-06-22T11:00:00.000Z",
    eventType: overrides.eventType ?? "consultation",
    googleMeetUrl: null,
    patientId: null,
    leadId: null,
    metadata: overrides.metadata ?? { source: "google_sync" },
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function createGc7MockSupabase() {
  const integrations: Record<string, unknown>[] = [];
  const events: EventRow[] = [];
  const reviewItems: ReviewRow[] = [];
  const inboundCalendars: Record<string, unknown>[] = [];
  const fiUsers: Record<string, unknown>[] = [
    { id: FI_USER, tenant_id: TENANT, auth_user_id: AUTH_USER },
  ];

  const client = {
    from(table: string) {
      if (table === "fi_users") {
        return {
          select() {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    return {
                      maybeSingle: async () => {
                        const row = fiUsers.find((u) => u[col] === val && u[col2] === val2);
                        return { data: row ?? null, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_calendar_sync_review_items") {
        const filterReview = (filters: Record<string, string>) =>
          reviewItems.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));

        const buildReviewChain = (filters: Record<string, string> = {}) => {
          const chain = {
            eq(col: string, val: string) {
              filters[col] = val;
              return chain;
            },
            order() {
              return chain;
            },
            limit() {
              return chain;
            },
            maybeSingle: async () => {
              const row = filterReview(filters)[0];
              return { data: row ?? null, error: null };
            },
            single: async () => {
              const row = filterReview(filters)[0];
              if (!row) return { data: null, error: { message: "not found" } };
              return { data: row, error: null };
            },
            then(
              resolve: (v: { data: ReviewRow[]; error: null; count?: number }) => void,
              reject?: (e: unknown) => void
            ) {
              try {
                if ("head" in chain) {
                  resolve({ data: [], error: null, count: filterReview(filters).length });
                } else {
                  resolve({ data: filterReview(filters), error: null });
                }
              } catch (e) {
                reject?.(e);
              }
            },
          };
          return chain;
        };

        return {
          select(_cols: string, opts?: { count?: string; head?: boolean }) {
            const chain = buildReviewChain();
            if (opts?.head) {
              (chain as { head?: boolean }).head = true;
            }
            return chain;
          },
          insert(row: ReviewRow) {
            const full = { id: randomUUID(), ...row };
            reviewItems.push(full);
            return {
              select() {
                return { single: async () => ({ data: full, error: null }) };
              },
            };
          },
          update(patch: ReviewRow) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    return {
                      select() {
                        return {
                          single: async () => {
                            const row = reviewItems.find((r) => r[col] === val && r[col2] === val2);
                            if (!row) return { data: null, error: { message: "not found" } };
                            Object.assign(row, patch);
                            return { data: row, error: null };
                          },
                        };
                      },
                    };
                  },
                  select() {
                    return {
                      single: async () => {
                        const row = reviewItems.find((r) => r[col] === val);
                        if (!row) return { data: null, error: { message: "not found" } };
                        Object.assign(row, patch);
                        return { data: row, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_calendar_inbound_sync_calendars") {
        const filterInbound = (filters: Record<string, string | boolean>) =>
          inboundCalendars.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
        const buildInboundChain = (filters: Record<string, string | boolean> = {}) => {
          const chain = {
            eq(col: string, val: string | boolean) {
              filters[col] = val;
              return chain;
            },
            order() {
              return chain;
            },
            then(
              resolve: (v: { data: Record<string, unknown>[]; error: null }) => void,
              reject?: (e: unknown) => void
            ) {
              try {
                resolve({ data: filterInbound(filters), error: null });
              } catch (e) {
                reject?.(e);
              }
            },
          };
          return chain;
        };
        return {
          select() {
            return buildInboundChain();
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    const row = inboundCalendars.find((r) => r[col] === val && r[col2] === val2);
                    if (row) Object.assign(row, patch);
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_calendar_integrations") {
        return {
          upsert(row: Record<string, unknown>) {
            const tenantId = String(row.tenant_id);
            const calendarId = String(row.calendar_id);
            const idx = integrations.findIndex(
              (r) => r.tenant_id === tenantId && r.calendar_id === calendarId
            );
            const id = idx >= 0 ? integrations[idx]!.id : randomUUID();
            const full = {
              ...row,
              id,
              provider: "google",
              status: row.status ?? "active",
              last_sync_status: row.last_sync_status ?? "never_synced",
              sync_failure_count: row.sync_failure_count ?? 0,
              created_at: row.created_at ?? new Date().toISOString(),
              updated_at: row.updated_at ?? new Date().toISOString(),
            };
            if (idx >= 0) integrations[idx] = full;
            else integrations.push(full);
            return {
              select() {
                return { single: async () => ({ data: full, error: null }) };
              },
            };
          },
          select() {
            return {
              eq(col: string, val: string) {
                const chain = {
                  eq(col2: string, val2: string) {
                    return {
                      order() {
                        return {
                          limit() {
                            return {
                              maybeSingle: async () => {
                                const row = integrations.find(
                                  (r) =>
                                    r.tenant_id === val && r[col2] === val2 && r.status === "active"
                                );
                                return { data: row ?? null, error: null };
                              },
                            };
                          },
                        };
                      },
                      maybeSingle: async () => {
                        const row = integrations.find(
                          (r) => r.tenant_id === val && r[col2] === val2
                        );
                        return { data: row ?? null, error: null };
                      },
                    };
                  },
                  neq() {
                    return chain;
                  },
                  order() {
                    return {
                      limit() {
                        return {
                          maybeSingle: async () => {
                            const row = integrations.find(
                              (r) => r.tenant_id === val && r.status === "active"
                            );
                            return { data: row ?? null, error: null };
                          },
                        };
                      },
                    };
                  },
                  maybeSingle: async () => {
                    const row = integrations.find((r) => r.tenant_id === val);
                    return { data: row ?? null, error: null };
                  },
                };
                return chain;
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(_col: string, _val: string) {
                return {
                  eq() {
                    return {
                      select() {
                        return { single: async () => ({ data: patch, error: null }) };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_calendar_events") {
        const filterEvents = (filters: Record<string, string>) =>
          events.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));

        const buildEventChain = (filters: Record<string, string> = {}) => {
          const chain = {
            eq(col: string, val: string) {
              filters[col] = val;
              return chain;
            },
            not(col: string, op: string, val: unknown) {
              if (op === "is" && val === null) {
                return chain;
              }
              return chain;
            },
            order() {
              return Promise.resolve({ data: filterEvents(filters), error: null });
            },
            maybeSingle: async () => {
              const row = filterEvents(filters)[0];
              return { data: row ?? null, error: null };
            },
            then(
              resolve: (v: { data: EventRow[]; error: null }) => void,
              reject?: (e: unknown) => void
            ) {
              try {
                resolve({ data: filterEvents(filters), error: null });
              } catch (e) {
                reject?.(e);
              }
            },
          };
          return chain;
        };

        return {
          select() {
            return buildEventChain();
          },
          insert(row: EventRow) {
            const full = {
              ...row,
              id: randomUUID(),
              provider: "google",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            events.push(full);
            return {
              select() {
                return { single: async () => ({ data: full, error: null }) };
              },
            };
          },
          update(patch: EventRow) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    const row = events.find((r) => r[col] === val && r[col2] === val2);
                    if (row) {
                      if (patch.metadata) row.metadata = patch.metadata;
                      Object.assign(row, patch);
                    }
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    integrations,
    events,
    reviewItems,
    inboundCalendars,
  };
}

function googleListFetch(items: unknown[]): typeof fetch {
  return async (url, init) => {
    const method = init?.method ?? "GET";
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "live-access", expires_in: 3600 }), {
        status: 200,
      });
    }
    if (method === "GET" && String(url).includes("/events")) {
      return new Response(JSON.stringify({ items }), { status: 200 });
    }
    return new Response("unexpected", { status: 500 });
  };
}

describe("CalendarOS GC-7 — conflict detection", () => {
  const local = baseLocalEvent();

  it("detect conflict: missing title", () => {
    const conflict = detectGoogleCalendarSyncConflict({
      googleEvent: {
        id: "g-no-title",
        summary: "   ",
        start: { dateTime: "2026-06-22T10:00:00Z" },
        end: { dateTime: "2026-06-22T11:00:00Z" },
      },
      calendarId: CALENDAR,
      localEvents: [],
    });
    assert.ok(conflict);
    assert.equal(conflict!.conflictType, "missing_required_fields");
  });

  it("detect conflict: title/start duplicate without external link", () => {
    const conflict = detectGoogleCalendarSyncConflict({
      googleEvent: {
        id: "g-dup",
        summary: local.title,
        start: { dateTime: "2026-06-22T10:00:00Z" },
        end: { dateTime: "2026-06-22T11:00:00Z" },
      },
      calendarId: CALENDAR,
      localEvents: [local],
    });
    assert.ok(conflict);
    assert.equal(conflict!.conflictType, "possible_duplicate");
    assert.equal(conflict!.matchedLocalEventId, local.id);
  });

  it("detect conflict: overlapping local FI event", () => {
    const conflict = detectGoogleCalendarSyncConflict({
      googleEvent: {
        id: "g-overlap",
        summary: "Different title",
        start: { dateTime: "2026-06-22T10:30:00Z" },
        end: { dateTime: "2026-06-22T11:30:00Z" },
      },
      calendarId: CALENDAR,
      localEvents: [local],
    });
    assert.ok(conflict);
    assert.equal(conflict!.conflictType, "time_overlap");
  });

  it("no conflict: clear new Google-native event", () => {
    const conflict = detectGoogleCalendarSyncConflict({
      googleEvent: {
        id: "g-clear",
        summary: "Brand new consult",
        start: { dateTime: "2026-07-01T10:00:00Z" },
        end: { dateTime: "2026-07-01T11:00:00Z" },
      },
      calendarId: CALENDAR,
      localEvents: [local],
    });
    assert.equal(conflict, null);
  });

  it("no conflict: existing external ID match (safe update)", () => {
    const conflict = detectGoogleCalendarSyncConflict({
      googleEvent: {
        id: local.externalEventId!,
        summary: local.title,
        start: { dateTime: "2026-06-22T10:00:00Z" },
        end: { dateTime: "2026-06-22T11:00:00Z" },
        updated: "2026-06-01T00:00:00.000Z",
      },
      calendarId: CALENDAR,
      existingByExternalId: local,
      localEvents: [local],
    });
    assert.equal(conflict, null);
  });

  it("detect conflict: cancelled unmatched", () => {
    const conflict = detectGoogleCalendarSyncConflict({
      googleEvent: {
        id: "g-cancel",
        status: "cancelled",
        summary: "Cancelled event",
        start: { dateTime: "2026-06-22T10:00:00Z" },
        end: { dateTime: "2026-06-22T11:00:00Z" },
      },
      calendarId: CALENDAR,
      localEvents: [],
    });
    assert.ok(conflict);
    assert.equal(conflict!.conflictType, "cancelled_unmatched");
  });

  it("sync summary includes conflictsByType via incrementReviewCounter", () => {
    const counters = emptyReviewSyncCounters();
    incrementReviewCounter(counters, "possible_duplicate", true);
    incrementReviewCounter(counters, "possible_duplicate", false);
    incrementReviewCounter(counters, "time_overlap", true);
    assert.equal(counters.conflictsDetected, 3);
    assert.equal(counters.reviewItemsCreated, 2);
    assert.equal(counters.reviewItemsUpdated, 1);
    assert.equal(counters.conflictsByType.possible_duplicate, 2);
    assert.equal(counters.conflictsByType.time_overlap, 1);
  });
});

describe("CalendarOS GC-7 — review queue helpers", () => {
  let mock: ReturnType<typeof createGc7MockSupabase>;

  beforeEach(() => {
    mock = createGc7MockSupabase();
  });

  const detection = detectGoogleCalendarSyncConflict({
    googleEvent: {
      id: "review-1",
      summary: "Dup consult",
      start: { dateTime: "2026-06-22T10:00:00Z" },
      end: { dateTime: "2026-06-22T11:00:00Z" },
    },
    calendarId: CALENDAR,
    localEvents: [baseLocalEvent()],
  })!;

  it("queue upsert idempotency", async () => {
    assert.ok(detection);
    const input = {
      tenantId: TENANT,
      integrationId: INTEGRATION,
      googleCalendarId: CALENDAR,
      googleCalendarSummary: "Primary",
      externalEventId: "review-1",
      googleEvent: { id: "review-1", summary: "Dup consult" },
      detection,
    };

    const first = await upsertGoogleCalendarSyncReviewItem(input, {
      supabaseClientForTests: mock.client,
    });
    const second = await upsertGoogleCalendarSyncReviewItem(input, {
      supabaseClientForTests: mock.client,
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(mock.reviewItems.length, 1);
  });

  it("dismiss review item", async () => {
    const upsert = await upsertGoogleCalendarSyncReviewItem(
      {
        tenantId: TENANT,
        integrationId: INTEGRATION,
        googleCalendarId: CALENDAR,
        googleCalendarSummary: null,
        externalEventId: "review-dismiss",
        googleEvent: { id: "review-dismiss", summary: "X" },
        detection: {
          ...detection,
          mappedFields: { ...detection.mappedFields, externalEventId: "review-dismiss" },
        },
      },
      { supabaseClientForTests: mock.client }
    );
    assert.equal(upsert.ok, true);
    if (!upsert.ok) return;

    const dismissed = await dismissGoogleCalendarSyncReviewItem(TENANT, upsert.item.id, AUTH_USER, {
      supabaseClientForTests: mock.client,
    });
    assert.equal(dismissed.ok, true);
    if (!dismissed.ok) return;
    assert.equal(dismissed.item.status, "dismissed");
  });

  it("import review item creates google_sync_review_import row", async () => {
    const importGoogleEvent = {
      id: "review-import",
      summary: "Import me",
      start: { dateTime: "2026-08-01T10:00:00Z" },
      end: { dateTime: "2026-08-01T11:00:00Z" },
    };
    const importDetection = {
      conflictType: "missing_required_fields" as const,
      conflictReason: "Test import path",
      severity: "review" as const,
      matchedLocalEventId: null,
      matchedLocalEventType: null,
      mappedFields: mapGoogleApiEventToFiFields(importGoogleEvent, CALENDAR),
    };

    const upsert = await upsertGoogleCalendarSyncReviewItem(
      {
        tenantId: TENANT,
        integrationId: INTEGRATION,
        googleCalendarId: CALENDAR,
        googleCalendarSummary: null,
        externalEventId: "review-import",
        googleEvent: importGoogleEvent,
        detection: importDetection,
      },
      { supabaseClientForTests: mock.client }
    );
    assert.equal(upsert.ok, true);
    if (!upsert.ok) return;

    const imported = await importGoogleCalendarSyncReviewItem(TENANT, upsert.item.id, AUTH_USER, {
      supabaseClientForTests: mock.client,
    });
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    assert.equal(imported.item.status, "imported");
    const row = mock.events.find((e) => e.external_event_id === "review-import");
    assert.ok(row);
    assert.equal((row!.metadata as Record<string, unknown>).source, "google_sync_review_import");
  });

  it("link review item sets external id on matched local row", async () => {
    const local = baseLocalEvent({ id: "local-link-target", externalEventId: null });
    mock.events.push({
      id: local.id,
      tenant_id: TENANT,
      external_event_id: null,
      provider: "google",
      calendar_id: CALENDAR,
      title: local.title,
      start_time: local.startTime,
      end_time: local.endTime,
      metadata: {},
    });

    const upsert = await upsertGoogleCalendarSyncReviewItem(
      {
        tenantId: TENANT,
        integrationId: INTEGRATION,
        googleCalendarId: CALENDAR,
        googleCalendarSummary: null,
        externalEventId: "review-link",
        googleEvent: { id: "review-link", summary: local.title },
        detection: {
          ...detection,
          conflictType: "possible_duplicate",
          matchedLocalEventId: local.id,
        },
      },
      { supabaseClientForTests: mock.client }
    );
    assert.equal(upsert.ok, true);
    if (!upsert.ok) return;

    const linked = await linkGoogleCalendarSyncReviewItem(TENANT, upsert.item.id, AUTH_USER, {
      supabaseClientForTests: mock.client,
    });
    assert.equal(linked.ok, true);
    const row = mock.events.find((e) => e.id === local.id);
    assert.equal(row!.external_event_id, "review-link");
  });

  it("listGoogleCalendarSyncReviewItemsForTenant returns open items", async () => {
    await upsertGoogleCalendarSyncReviewItem(
      {
        tenantId: TENANT,
        integrationId: INTEGRATION,
        googleCalendarId: CALENDAR,
        googleCalendarSummary: null,
        externalEventId: "list-1",
        googleEvent: { id: "list-1", summary: "One" },
        detection,
      },
      { supabaseClientForTests: mock.client }
    );

    const items = await listGoogleCalendarSyncReviewItemsForTenant(TENANT, {
      supabaseClientForTests: mock.client,
      status: "open",
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]!.externalEventId, "list-1");
  });
});

describe("CalendarOS GC-7 — inbound sync staging", () => {
  const origEnv = { ...process.env };
  let mock: ReturnType<typeof createGc7MockSupabase>;

  beforeEach(async () => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    mock = createGc7MockSupabase();
    await storeGoogleCalendarCredentials(
      {
        tenantId: TENANT,
        calendarId: CALENDAR,
        accessToken: "live-access",
        refreshToken: "live-refresh",
        expiresInSeconds: 3600,
      },
      { supabaseClientForTests: mock.client }
    );
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("stages duplicate-looking event instead of inserting", async () => {
    mock.events.push({
      id: randomUUID(),
      tenant_id: TENANT,
      external_event_id: "existing-local",
      provider: "google",
      calendar_id: CALENDAR,
      title: "Hair Consultation",
      start_time: "2026-06-22T10:00:00.000Z",
      end_time: "2026-06-22T11:00:00.000Z",
      metadata: { source: "google_sync" },
    });

    const result = await syncGoogleCalendarEvents(TENANT, {
      supabaseClientForTests: mock.client,
      fetchOverride: googleListFetch([
        {
          id: "google-dup",
          summary: "Hair Consultation",
          start: { dateTime: "2026-06-22T10:00:00Z" },
          end: { dateTime: "2026-06-22T11:00:00Z" },
        },
      ]),
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.result.created, 0);
    assert.ok((result.data.result.reviewSummary?.conflictsDetected ?? 0) >= 1);
    assert.equal(
      mock.reviewItems.some((r) => r.external_event_id === "google-dup"),
      true
    );
    assert.equal(
      mock.events.some((e) => e.external_event_id === "google-dup"),
      false
    );
  });

  it("still auto-inserts clear new Google-native events", async () => {
    const result = await syncGoogleCalendarEvents(TENANT, {
      supabaseClientForTests: mock.client,
      fetchOverride: googleListFetch([
        {
          id: "clear-new",
          summary: "Clear new event",
          start: { dateTime: "2026-08-10T10:00:00Z" },
          end: { dateTime: "2026-08-10T11:00:00Z" },
        },
      ]),
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.result.created, 1);
    assert.ok(mock.events.some((e) => e.external_event_id === "clear-new"));
  });
});

describe("CalendarOS GC-7 — crypto sanity", () => {
  it("encrypts tokens for mock setup", () => {
    const key = deriveExternalConnectorMasterKey(MASTER_KEY);
    const encrypted = encryptExternalConnectorSecret("token", key!);
    assert.equal(decryptExternalConnectorSecret(encrypted, key!), "token");
  });
});
