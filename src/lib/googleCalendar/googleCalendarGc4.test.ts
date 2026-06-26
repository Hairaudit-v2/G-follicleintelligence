import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { storeGoogleCalendarCredentials } from "./googleCalendarAuth.server";
import {
  appendCalendarAppointmentActivity,
  buildGoogleCalendarEventPayload,
  createFiCalendarAppointment,
  createFiGoogleMeetAppointment,
  isValidAppointmentAttendeeEmail,
  normalizeFiAppointmentInput,
  sanitizeFiAppointmentForResponse,
} from "./googleCalendarAppointment.server";
import { handleCreateCalendarAppointment } from "./googleCalendarAppointmentRoutes.server";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CALENDAR = "primary";
const MASTER_KEY = "gc4-test-master-key";
const ACTOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type IntegrationRow = Record<string, unknown>;
type EventRow = Record<string, unknown>;

function createMockSupabase() {
  const integrations: IntegrationRow[] = [];
  const events: EventRow[] = [];

  const client = {
    from(table: string) {
      if (table === "fi_calendar_integrations") {
        return {
          upsert(row: IntegrationRow) {
            const tenantId = String(row.tenant_id);
            const calendarId = String(row.calendar_id);
            const idx = integrations.findIndex(
              (r) => r.tenant_id === tenantId && r.calendar_id === calendarId
            );
            const id = idx >= 0 ? integrations[idx].id : randomUUID();
            const full = {
              ...row,
              id,
              provider: "google",
              status: row.status ?? "active",
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
                                    r.tenant_id === val &&
                                    r[col2] === val2 &&
                                    r.status === "active"
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
          update(patch: IntegrationRow) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    return {
                      select() {
                        return {
                          single: async () => {
                            const row = integrations.find(
                              (r) => r[col] === val && r[col2] === val2
                            );
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
          },
        };
      }

      if (table === "fi_calendar_events") {
        const filterEvents = (filters: Record<string, string>) =>
          events.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));

        const buildEventChain = (filters: Record<string, string>) => {
          const chain = {
            eq(col: string, val: string) {
              filters[col] = val;
              return chain;
            },
            maybeSingle: async () => {
              const row = filterEvents(filters)[0];
              return { data: row ?? null, error: null };
            },
          };
          return chain;
        };

        return {
          select(_cols?: string) {
            return buildEventChain({});
          },
          insert(row: EventRow) {
            const full: EventRow = {
              ...row,
              id: randomUUID(),
              provider: "google",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            const dup = events.find(
              (e) =>
                e.external_event_id &&
                full.external_event_id &&
                e.external_event_id === full.external_event_id
            );
            if (dup) {
              return {
                select() {
                  return {
                    single: async () => ({
                      data: null,
                      error: { code: "23505", message: "duplicate" },
                    }),
                  };
                },
              };
            }
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
                    return Promise.resolve({ error: null }).then(() => {
                      const row = events.find((r) => r[col] === val && r[col2] === val2);
                      if (row) {
                        if (patch.metadata !== undefined) row.metadata = patch.metadata;
                        Object.assign(row, { ...patch, metadata: row.metadata });
                        row.updated_at = new Date().toISOString();
                      }
                    });
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
  };
}

function googleFetchHandler(opts?: { meet?: boolean; eventId?: string }): typeof fetch {
  return async (url, init) => {
    const method = init?.method ?? "GET";
    const path = String(url);

    if (path.includes("oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({ access_token: "live-access", expires_in: 3600 }),
        { status: 200 }
      );
    }

    if (method === "POST" && path.includes("/events")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const params = new URL(path).searchParams;
      assert.equal(params.get("sendUpdates"), "none");

      if (opts?.meet || body.conferenceData) {
        assert.equal(params.get("conferenceDataVersion"), "1");
        return new Response(
          JSON.stringify({
            id: opts?.eventId ?? "google-meet-evt-gc4",
            summary: body.summary,
            start: body.start,
            end: body.end,
            hangoutLink: "https://meet.google.com/gc4-test-link",
            updated: "2026-06-22T10:00:00.000Z",
          }),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          id: opts?.eventId ?? "google-evt-gc4",
          summary: body.summary,
          start: body.start,
          end: body.end,
          updated: "2026-06-22T10:00:00.000Z",
        }),
        { status: 200 }
      );
    }

    return new Response("unexpected", { status: 500 });
  };
}

const validInput = {
  tenantId: TENANT,
  title: "Consultation - Test Patient",
  startTime: "2026-07-01T10:00:00.000Z",
  endTime: "2026-07-01T10:30:00.000Z",
};

describe("CalendarOS GC-4 — input validation", () => {
  it("isValidAppointmentAttendeeEmail accepts valid emails", () => {
    assert.equal(isValidAppointmentAttendeeEmail("patient@example.com"), true);
    assert.equal(isValidAppointmentAttendeeEmail("not-an-email"), false);
  });

  it("normalizeFiAppointmentInput requires tenantId and title", () => {
    assert.equal(normalizeFiAppointmentInput({ ...validInput, tenantId: "" }).ok, false);
    assert.equal(normalizeFiAppointmentInput({ ...validInput, title: "  " }).ok, false);
  });

  it("normalizeFiAppointmentInput rejects endTime before or equal to startTime", () => {
    const bad = normalizeFiAppointmentInput({
      ...validInput,
      startTime: "2026-07-01T10:00:00.000Z",
      endTime: "2026-07-01T09:00:00.000Z",
    });
    assert.equal(bad.ok, false);
    if (bad.ok) return;
    assert.match(bad.error, /after start/i);

    const equal = normalizeFiAppointmentInput({
      ...validInput,
      endTime: validInput.startTime,
    });
    assert.equal(equal.ok, false);
  });

  it("normalizeFiAppointmentInput validates attendee emails", () => {
    const bad = normalizeFiAppointmentInput({
      ...validInput,
      attendees: ["bad-email"],
    });
    assert.equal(bad.ok, false);
    if (bad.ok) return;
    assert.match(bad.error, /Invalid attendee email/i);
  });

  it("normalizeFiAppointmentInput defaults eventType to consultation", () => {
    const result = normalizeFiAppointmentInput(validInput);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data!.normalized.eventType, "consultation");
  });

  it("buildGoogleCalendarEventPayload includes attendees and conferenceData", () => {
    const normalized = normalizeFiAppointmentInput({
      ...validInput,
      addGoogleMeet: true,
      attendees: ["Patient@Example.com"],
    });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) return;

    const payload = buildGoogleCalendarEventPayload(normalized.data!.normalized);
    assert.equal(payload.summary, validInput.title);
    assert.ok(payload.conferenceData);
    const attendees = payload.attendees as { email: string }[];
    assert.equal(attendees[0].email, "patient@example.com");
  });
});

describe("CalendarOS GC-4 — appointment creation", () => {
  const origEnv = { ...process.env };
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(async () => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    mock = createMockSupabase();
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

  it("rejects missing Google integration", async () => {
    const empty = createMockSupabase();
    const result = await createFiCalendarAppointment(validInput, {
      supabaseClientForTests: empty.client,
      fetchOverride: googleFetchHandler(),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /not connected/i);
  });

  it("creates local FI event after Google event", async () => {
    const result = await createFiCalendarAppointment(validInput, {
      supabaseClientForTests: mock.client,
      fetchOverride: googleFetchHandler(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(mock.events.length, 1);
    assert.equal(result.data.appointment.external_event_id, "google-evt-gc4");
  });

  it("stores Google Meet link when addGoogleMeet=true", async () => {
    const result = await createFiGoogleMeetAppointment(validInput, {
      supabaseClientForTests: mock.client,
      fetchOverride: googleFetchHandler({ meet: true }),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.appointment.google_meet_url, "https://meet.google.com/gc4-test-link");
  });

  it("no Google Meet link when addGoogleMeet=false", async () => {
    const result = await createFiCalendarAppointment(
      { ...validInput, addGoogleMeet: false },
      {
        supabaseClientForTests: mock.client,
        fetchOverride: googleFetchHandler(),
      }
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.appointment.google_meet_url, null);
  });

  it("duplicate external_event_id does not create duplicate local event on retry", async () => {
    const fetchOverride = googleFetchHandler({ eventId: "dup-ext-gc4" });
    const opts = { supabaseClientForTests: mock.client, fetchOverride };

    const first = await createFiCalendarAppointment(validInput, opts);
    assert.equal(first.ok, true);

    const second = await createFiCalendarAppointment(
      { ...validInput, title: "Retry title" },
      opts
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(mock.events.length, 1);
    assert.equal(second.data.event.metadata.deduplicated_on_retry, true);
  });

  it("sanitizeFiAppointmentForResponse omits tokens and metadata", () => {
    const sanitized = sanitizeFiAppointmentForResponse({
      id: "evt-id",
      tenantId: TENANT,
      externalEventId: "ext-1",
      provider: "google",
      calendarId: CALENDAR,
      title: "Test",
      description: "secret desc",
      location: null,
      startTime: validInput.startTime,
      endTime: validInput.endTime,
      eventType: "consultation",
      googleMeetUrl: "https://meet.google.com/x",
      patientId: null,
      leadId: null,
      metadata: { access_token: "must-not-leak", source: "fi" },
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });

    assert.deepEqual(Object.keys(sanitized).sort(), [
      "calendar_id",
      "end_time",
      "external_event_id",
      "google_meet_url",
      "id",
      "start_time",
      "title",
    ]);
    assert.equal((sanitized as Record<string, unknown>).access_token, undefined);
  });

  it("appendCalendarAppointmentActivity records metadata activity", async () => {
    mock.events.push({
      id: "local-1",
      tenant_id: TENANT,
      metadata: {},
    });

    await appendCalendarAppointmentActivity(mock.client, "local-1", TENANT, {
      action: "created",
      actorAuthUserId: ACTOR,
    });

    const row = mock.events[0];
    const activity = (row.metadata as { appointment_activity?: unknown[] }).appointment_activity;
    assert.ok(Array.isArray(activity));
    assert.equal(activity!.length, 1);
  });
});

describe("CalendarOS GC-4 — API route", () => {
  const origEnv = { ...process.env };
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(async () => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    mock = createMockSupabase();
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

  it("API rejects unauthorized request", async () => {
    const req = new Request(`https://app.example.com/api/tenants/${TENANT}/calendar/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test",
        startTime: validInput.startTime,
        endTime: validInput.endTime,
        addGoogleMeet: false,
      }),
    });

    const res = await handleCreateCalendarAppointment(TENANT, req, {
      supabaseClientForTests: mock.client,
    });
    assert.equal(res.status, 401);
  });

  it("API returns sanitized appointment only", async () => {
    const req = new Request(`https://app.example.com/api/tenants/${TENANT}/calendar/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "API Test Appointment",
        startTime: validInput.startTime,
        endTime: validInput.endTime,
        addGoogleMeet: true,
        attendees: ["guest@example.com"],
      }),
    });

    const res = await handleCreateCalendarAppointment(TENANT, req, {
      supabaseClientForTests: mock.client,
      fetchOverride: googleFetchHandler({ meet: true }),
      skipAuthCheck: true,
      actorAuthUserId: ACTOR,
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      appointment?: Record<string, unknown>;
      error?: string;
    };
    assert.equal(body.success, true);
    assert.ok(body.appointment);
    assert.equal(body.appointment!.title, "API Test Appointment");
    assert.equal(body.appointment!.google_meet_url, "https://meet.google.com/gc4-test-link");
    assert.equal(body.appointment!.access_token, undefined);
    assert.equal(body.appointment!.metadata, undefined);
  });
});
