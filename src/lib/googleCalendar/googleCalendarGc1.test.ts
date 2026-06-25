import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  decryptExternalConnectorSecret,
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
} from "@/src/lib/onboarding-os/externalConnectorSecretCrypto.server";

import {
  buildDeletedFromProviderMetadata,
  buildGoogleMeetConferenceRequest,
  buildGoogleOAuthAuthorizeUrl,
  detectDeletedExternalEvents,
  extractGoogleMeetUrl,
  isAccessTokenExpired,
  isDuplicateFiCalendarEvent,
  mapGoogleApiEventToFiFields,
  shouldUpdateFiEventFromGoogle,
} from "@/src/lib/googleCalendar/googleCalendarCore";
import {
  connectGoogleCalendar,
  refreshGoogleCalendarAccessToken,
  storeGoogleCalendarCredentials,
} from "@/src/lib/googleCalendar/googleCalendarAuth.server";
import {
  createGoogleCalendarEvent,
  createGoogleMeetAppointment,
  deleteGoogleCalendarEvent,
  syncGoogleCalendarEvents,
  updateGoogleCalendarEvent,
} from "@/src/lib/googleCalendar/googleCalendarService.server";
import type { FiCalendarEvent } from "@/src/lib/googleCalendar/googleCalendarTypes";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CALENDAR = "primary";
const MASTER_KEY = "gc1-test-master-key";

type IntegrationRow = Record<string, unknown>;
type EventRow = Record<string, unknown>;

function createMockSupabase() {
  const integrations: IntegrationRow[] = [];
  const events: EventRow[] = [];

  const client = {
    from(table: string) {
      if (table === "fi_calendar_integrations") {
        return {
          upsert(row: IntegrationRow, _opts?: { onConflict?: string }) {
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
                          (r) => r.tenant_id === val && (col2 ? r[col2] === val2 : true)
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
            gte() {
              return chain;
            },
            lte() {
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
              return { select() { return { single: async () => ({ data: null, error: { code: "23505", message: "duplicate" } }) }; } };
            }
            events.push(full);
            return {
              select() {
                return { single: async () => ({ data: full, error: null }) };
              },
            };
          },
          update(patch: EventRow) {
            const applyToRow = (row: EventRow | undefined) => {
              if (!row) return { data: null, error: { message: "not found" } };
              if (patch.metadata !== undefined) {
                row.metadata = patch.metadata;
              }
              const { metadata: _meta, ...rest } = patch;
              Object.assign(row, rest);
              row.updated_at = patch.updated_at ?? new Date().toISOString();
              return { data: row, error: null };
            };

            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    const row = events.find((r) => r[col] === val && r[col2] === val2);
                    const result = applyToRow(row);
                    const chain = {
                      select() {
                        return {
                          single: async () => result,
                        };
                      },
                      then(
                        resolve: (v: { error: { message: string } | null }) => void,
                        reject?: (e: unknown) => void
                      ) {
                        try {
                          resolve({ error: result.error });
                        } catch (e) {
                          reject?.(e);
                        }
                      },
                    };
                    return chain;
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

describe("CalendarOS GC-1 — credential encryption", () => {
  it("encrypts and decrypts tokens with AES-256-GCM", () => {
    const key = deriveExternalConnectorMasterKey(MASTER_KEY);
    assert.ok(key);
    const plaintext = "ya29.access-token-secret";
    const encrypted = encryptExternalConnectorSecret(plaintext, key!);
    assert.notEqual(encrypted, plaintext);
    const decrypted = decryptExternalConnectorSecret(encrypted, key!);
    assert.equal(decrypted, plaintext);
  });

  it("storeGoogleCalendarCredentials writes encrypted blobs (never plaintext)", async () => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    const { client, integrations } = createMockSupabase();

    const result = await storeGoogleCalendarCredentials(
      {
        tenantId: TENANT,
        calendarId: CALENDAR,
        accessToken: "access-abc",
        refreshToken: "refresh-xyz",
        expiresInSeconds: 3600,
        googleAccountEmail: "support@follicleintelligence.ai",
      },
      { supabaseClientForTests: client }
    );

    assert.equal(result.ok, true);
    const row = integrations[0];
    assert.ok(row);
    assert.notEqual(row.access_token_encrypted, "access-abc");
    assert.notEqual(row.refresh_token_encrypted, "refresh-xyz");
    assert.ok(String(row.access_token_encrypted).length > 20);
  });
});

describe("CalendarOS GC-1 — Google Meet and mapping", () => {
  it("extractGoogleMeetUrl reads hangoutLink and conference entry points", () => {
    assert.equal(
      extractGoogleMeetUrl({
        hangoutLink: "https://meet.google.com/abc-defg-hij",
      }),
      "https://meet.google.com/abc-defg-hij"
    );

    assert.equal(
      extractGoogleMeetUrl({
        conferenceData: {
          entryPoints: [
            { entryPointType: "video", uri: "https://meet.google.com/xyz-uvw-rst" },
          ],
        },
      }),
      "https://meet.google.com/xyz-uvw-rst"
    );
  });

  it("buildGoogleMeetConferenceRequest uses hangoutsMeet solution", () => {
    const conf = buildGoogleMeetConferenceRequest("req-1");
    assert.equal(conf?.createRequest?.conferenceSolutionKey.type, "hangoutsMeet");
    assert.equal(conf?.createRequest?.requestId, "req-1");
  });

  it("mapGoogleApiEventToFiFields classifies consultation events", () => {
    const mapped = mapGoogleApiEventToFiFields(
      {
        id: "evt-1",
        summary: "Hair Consultation",
        start: { dateTime: "2026-06-22T10:00:00Z" },
        end: { dateTime: "2026-06-22T11:00:00Z" },
      },
      CALENDAR
    );
    assert.equal(mapped.externalEventId, "evt-1");
    assert.equal(mapped.eventType, "consultation");
  });
});

describe("CalendarOS GC-1 — deduplication and sync detection", () => {
  const baseEvent: FiCalendarEvent = {
    id: "1",
    tenantId: TENANT,
    externalEventId: "ext-1",
    provider: "google",
    calendarId: CALENDAR,
    title: "Consult",
    description: null,
    location: null,
    startTime: "2026-06-22T10:00:00.000Z",
    endTime: "2026-06-22T11:00:00.000Z",
    eventType: "consultation",
    googleMeetUrl: null,
    patientId: null,
    leadId: null,
    metadata: {},
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };

  it("isDuplicateFiCalendarEvent matches external id and title+start", () => {
    assert.equal(
      isDuplicateFiCalendarEvent(
        { externalEventId: "ext-1", title: "Other", startTime: null },
        [baseEvent]
      ),
      true
    );

    assert.equal(
      isDuplicateFiCalendarEvent(
        { externalEventId: "ext-2", title: "Consult", startTime: baseEvent.startTime },
        [baseEvent]
      ),
      true
    );
  });

  it("detectDeletedExternalEvents finds missing provider events", () => {
    const deleted = detectDeletedExternalEvents(
      [baseEvent, { ...baseEvent, id: "2", externalEventId: "ext-2", metadata: {} }],
      new Set(["ext-1"])
    );
    assert.deepEqual(deleted, ["2"]);
  });

  it("buildDeletedFromProviderMetadata marks sync_status deleted_external", () => {
    const meta = buildDeletedFromProviderMetadata({ source: "google_sync" }, "2026-06-22T12:00:00.000Z");
    assert.equal(meta.deleted_from_provider, true);
    assert.equal(meta.sync_status, "deleted_external");
  });

  it("shouldUpdateFiEventFromGoogle compares Google updated timestamp", () => {
    assert.equal(
      shouldUpdateFiEventFromGoogle(baseEvent, {
        id: "ext-1",
        updated: "2026-06-15T00:00:00.000Z",
      }),
      true
    );
    assert.equal(
      shouldUpdateFiEventFromGoogle(
        { ...baseEvent, updatedAt: "2026-06-20T00:00:00.000Z" },
        { id: "ext-1", updated: "2026-06-01T00:00:00.000Z" }
      ),
      false
    );
  });
});

describe("CalendarOS GC-1 — OAuth and token refresh", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://app.example.com/api/google-calendar/oauth/callback";
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("connectGoogleCalendar returns OAuth authorize URL without secrets", async () => {
    const result = await connectGoogleCalendar(TENANT);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.authUrl.includes("accounts.google.com/o/oauth2"));
    assert.ok(result.authUrl.includes("client_id=client-id"));
    assert.ok(!result.authUrl.includes("client-secret"));
    assert.ok(result.state.length > 8);
  });

  it("buildGoogleOAuthAuthorizeUrl includes offline access and calendar scopes", () => {
    const url = buildGoogleOAuthAuthorizeUrl({
      clientId: "cid",
      redirectUri: "https://example.com/cb",
      state: "state-1",
    });
    assert.ok(url.includes("access_type=offline"));
    assert.ok(url.includes("calendar"));
  });

  it("isAccessTokenExpired respects buffer window", () => {
    const soon = new Date(Date.now() + 30_000).toISOString();
    assert.equal(isAccessTokenExpired(soon, 60), true);
    const later = new Date(Date.now() + 120_000).toISOString();
    assert.equal(isAccessTokenExpired(later, 60), false);
  });

  it("refreshGoogleCalendarAccessToken exchanges refresh token and updates encrypted access token", async () => {
    const { client, integrations } = createMockSupabase();
    await storeGoogleCalendarCredentials(
      {
        tenantId: TENANT,
        calendarId: CALENDAR,
        accessToken: "old-access",
        refreshToken: "refresh-token",
        tokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
      { supabaseClientForTests: client }
    );

    const fetchOverride: typeof fetch = async (url, _init) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "new-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200 }
        );
      }
      return new Response("not found", { status: 404 });
    };

    const result = await refreshGoogleCalendarAccessToken(TENANT, {
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data!.accessToken, "new-access-token");
    assert.notEqual(integrations[0].access_token_encrypted, "new-access-token");
    assert.equal(integrations[0].status, "active");
  });
});

describe("CalendarOS GC-1 — event CRUD via service layer", () => {
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

  function googleFetchHandler(handlers: Record<string, (body?: unknown) => unknown>): typeof fetch {
    return async (url, init) => {
      const method = init?.method ?? "GET";
      const path = String(url);

      if (path.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "live-access", expires_in: 3600 }),
          { status: 200 }
        );
      }

      if (method === "POST" && path.includes("/events") && path.includes("conferenceDataVersion")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        assert.ok(body.conferenceData);
        return new Response(
          JSON.stringify({
            id: "google-meet-evt",
            summary: body.summary,
            start: body.start,
            end: body.end,
            hangoutLink: "https://meet.google.com/abc-defg-hij",
            updated: "2026-06-22T10:00:00.000Z",
          }),
          { status: 200 }
        );
      }

      if (method === "POST" && path.includes("/events")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        return new Response(
          JSON.stringify({
            id: "google-evt-1",
            summary: body.summary,
            description: body.description,
            start: body.start,
            end: body.end,
            updated: "2026-06-22T10:00:00.000Z",
          }),
          { status: 200 }
        );
      }

      if (method === "PATCH" && path.includes("/events/")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        return new Response(
          JSON.stringify({
            id: "google-evt-1",
            summary: body.summary ?? "Updated title",
            start: body.start ?? { dateTime: "2026-06-22T10:00:00Z" },
            end: body.end ?? { dateTime: "2026-06-22T11:00:00Z" },
            updated: "2026-06-23T10:00:00.000Z",
          }),
          { status: 200 }
        );
      }

      if (method === "DELETE" && path.includes("/events/")) {
        return new Response(null, { status: 204 });
      }

      if (method === "GET" && path.includes("/events")) {
        const items = handlers.list?.() ?? [];
        return new Response(JSON.stringify({ items }), { status: 200 });
      }

      return new Response("unexpected", { status: 500 });
    };
  }

  it("createGoogleCalendarEvent creates Google event and FI mirror", async () => {
    const fetchOverride = googleFetchHandler({});

    const result = await createGoogleCalendarEvent(
      {
        tenantId: TENANT,
        title: "PRP Session",
        startTime: "2026-06-22T10:00:00.000Z",
        endTime: "2026-06-22T11:00:00.000Z",
        eventType: "prp",
      },
      { supabaseClientForTests: mock.client, fetchOverride }
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.event.externalEventId, "google-evt-1");
    assert.equal(result.data.event.title, "PRP Session");
    assert.equal(mock.events.length, 1);
  });

  it("createGoogleMeetAppointment stores google_meet_url", async () => {
    const fetchOverride = googleFetchHandler({});

    const result = await createGoogleMeetAppointment(
      {
        tenantId: TENANT,
        title: "Video Consultation",
        startTime: "2026-06-22T14:00:00.000Z",
        endTime: "2026-06-22T15:00:00.000Z",
      },
      { supabaseClientForTests: mock.client, fetchOverride }
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.event.googleMeetUrl, "https://meet.google.com/abc-defg-hij");
  });

  it("updateGoogleCalendarEvent patches Google and local mirror", async () => {
    const fetchOverride = googleFetchHandler({});
    const created = await createGoogleCalendarEvent(
      {
        tenantId: TENANT,
        title: "Initial title",
        startTime: "2026-06-22T10:00:00.000Z",
        endTime: "2026-06-22T11:00:00.000Z",
      },
      { supabaseClientForTests: mock.client, fetchOverride }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const updated = await updateGoogleCalendarEvent(
      {
        tenantId: TENANT,
        eventId: created.data.event.id,
        title: "Updated title",
      },
      { supabaseClientForTests: mock.client, fetchOverride }
    );

    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.equal(updated.data.event.title, "Updated title");
  });

  it("deleteGoogleCalendarEvent removes from Google and marks local metadata", async () => {
    const fetchOverride = googleFetchHandler({});
    const created = await createGoogleCalendarEvent(
      {
        tenantId: TENANT,
        title: "To delete",
        startTime: "2026-06-22T10:00:00.000Z",
        endTime: "2026-06-22T11:00:00.000Z",
      },
      { supabaseClientForTests: mock.client, fetchOverride }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const deleted = await deleteGoogleCalendarEvent(
      TENANT,
      created.data.event.id,
      { supabaseClientForTests: mock.client, fetchOverride }
    );

    assert.equal(deleted.ok, true);
    if (!deleted.ok) return;
    assert.equal(deleted.data.event.metadata.deleted_locally, true);
  });

  it("createGoogleCalendarEvent rejects duplicate title+start", async () => {
    const fetchOverride = googleFetchHandler({});
    const first = await createGoogleCalendarEvent(
      {
        tenantId: TENANT,
        title: "Duplicate consult",
        startTime: "2026-06-22T10:00:00.000Z",
        endTime: "2026-06-22T11:00:00.000Z",
      },
      { supabaseClientForTests: mock.client, fetchOverride }
    );
    assert.equal(first.ok, true);

    const second = await createGoogleCalendarEvent(
      {
        tenantId: TENANT,
        title: "Duplicate consult",
        startTime: "2026-06-22T10:00:00.000Z",
        endTime: "2026-06-22T11:00:00.000Z",
      },
      { supabaseClientForTests: mock.client, fetchOverride }
    );
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.match(second.error, /Duplicate/i);
  });

  it("syncGoogleCalendarEvents deduplicates, updates, and detects deletions", async () => {
    mock.events.push({
      id: randomUUID(),
      tenant_id: TENANT,
      external_event_id: "sync-existing",
      provider: "google",
      calendar_id: CALENDAR,
      title: "Existing event",
      description: null,
      location: null,
      start_time: "2026-06-20T10:00:00.000Z",
      end_time: "2026-06-20T11:00:00.000Z",
      event_type: "consultation",
      google_meet_url: null,
      patient_id: null,
      lead_id: null,
      metadata: { source: "google_sync" },
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    });

    mock.events.push({
      id: randomUUID(),
      tenant_id: TENANT,
      external_event_id: "sync-deleted",
      provider: "google",
      calendar_id: CALENDAR,
      title: "Will be deleted externally",
      description: null,
      location: null,
      start_time: "2026-06-21T10:00:00.000Z",
      end_time: "2026-06-21T11:00:00.000Z",
      event_type: "consultation",
      google_meet_url: null,
      patient_id: null,
      lead_id: null,
      metadata: { source: "google_sync" },
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    });

    const fetchOverride = googleFetchHandler({
      list: () => [
        {
          id: "sync-existing",
          summary: "Existing event updated",
          start: { dateTime: "2026-06-20T10:00:00Z" },
          end: { dateTime: "2026-06-20T11:00:00Z" },
          updated: "2026-06-25T00:00:00.000Z",
        },
        {
          id: "sync-new",
          summary: "New synced event",
          start: { dateTime: "2026-06-24T10:00:00Z" },
          end: { dateTime: "2026-06-24T11:00:00Z" },
          updated: "2026-06-24T00:00:00.000Z",
        },
      ],
    });

    const result = await syncGoogleCalendarEvents(TENANT, {
      supabaseClientForTests: mock.client,
      fetchOverride,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.result.created, 1);
    assert.equal(result.data.result.updated, 1);
    assert.equal(result.data.result.deleted, 1);

    const deletedRow = mock.events.find((e) => e.external_event_id === "sync-deleted");
    assert.ok(deletedRow);
    assert.equal((deletedRow!.metadata as Record<string, unknown>).deleted_from_provider, true);
  });
});
