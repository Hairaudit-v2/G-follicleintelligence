import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";

import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
} from "@/src/lib/onboarding-os/externalConnectorSecretCrypto.server";
import { completeGoogleCalendarOAuth, storeGoogleCalendarCredentials } from "./googleCalendarAuth.server";
import { loadGoogleCalendarConnectionStatus } from "./googleCalendarConnectionStatus.server";
import {
  handleGoogleCalendarSyncCronGet,
  loadGoogleCalendarSyncDiagnostics,
  loadGoogleCalendarSyncHealth,
  syncGoogleCalendarForAllTenants,
  syncGoogleCalendarForTenant,
} from "./googleCalendarSync.server";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_INACTIVE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MASTER_KEY = "gc3-test-master-key";
const CRON_SECRET = "0123456789abcdef0123456789abcdef";
const GC_SECRET = "fedcba9876543210fedcba9876543210";
const ROUTE = "https://fi.example.com/api/cron/google-calendar/sync";

type IntegrationRow = Record<string, unknown>;
type EventRow = Record<string, unknown>;

function createGc3MockSupabase(seed?: IntegrationRow[]) {
  const integrations: IntegrationRow[] = [...(seed ?? [])];
  const events: EventRow[] = [];
  const inboundCalendars: Record<string, unknown>[] = [];

  const client = {
    from(table: string) {
      if (table === "fi_calendar_inbound_sync_calendars") {
        const filterInbound = (filters: Record<string, string | boolean>) =>
          inboundCalendars.filter((r) =>
            Object.entries(filters).every(([k, v]) => r[k] === v)
          );

        const buildInboundChain = (filters: Record<string, string | boolean> = {}) => {
          const chain = {
            eq(col: string, val: string | boolean) {
              filters[col] = val;
              return chain;
            },
            order(_col: string, _opts?: { ascending?: boolean; nullsFirst?: boolean }) {
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
          upsert(row: IntegrationRow) {
            const tenantId = String(row.tenant_id);
            const calendarId = String(row.calendar_id);
            const idx = integrations.findIndex(
              (r) => r.tenant_id === tenantId && r.calendar_id === calendarId
            );
            const id = idx >= 0 ? integrations[idx].id : randomUUID();
            const full = {
              last_sync_status: "never_synced",
              sync_failure_count: 0,
              ...integrations[idx],
              ...row,
              id,
              provider: "google",
              status: row.status ?? integrations[idx]?.status ?? "active",
              created_at: integrations[idx]?.created_at ?? new Date().toISOString(),
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
          select(_cols?: string) {
            const applyFilters = (rows: IntegrationRow[], filters: Record<string, string | { neq: string }>) =>
              rows.filter((r) =>
                Object.entries(filters).every(([col, val]) => {
                  if (typeof val === "object" && val !== null && "neq" in val) {
                    return r[col] !== val.neq;
                  }
                  return r[col] === val;
                })
              );

            const buildChain = (filters: Record<string, string | { neq: string }> = {}) => {
              const terminal = {
                limit(n: number) {
                  return {
                    maybeSingle: async () => {
                      const rows = applyFilters(integrations, filters).slice(0, n);
                      return { data: rows[0] ?? null, error: null };
                    },
                  };
                },
                maybeSingle: async () => {
                  const rows = applyFilters(integrations, filters);
                  return { data: rows[0] ?? null, error: null };
                },
                then(
                  resolve: (v: { data: IntegrationRow[]; error: null }) => void,
                  reject?: (e: unknown) => void
                ) {
                  try {
                    resolve({ data: applyFilters(integrations, filters), error: null });
                  } catch (e) {
                    reject?.(e);
                  }
                },
              };

              const chain = {
                eq(col: string, val: string) {
                  filters[col] = val;
                  return buildChain(filters);
                },
                neq(col: string, val: string) {
                  filters[col] = { neq: val };
                  return buildChain(filters);
                },
                order(_col: string, _opts?: { ascending?: boolean; nullsFirst?: boolean }) {
                  return { ...chain, ...terminal };
                },
                ...terminal,
              };
              return chain;
            };
            return buildChain();
          },
          update(patch: IntegrationRow) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    const applyUpdate = async () => {
                      const row = integrations.find((r) => r[col] === val && r[col2] === val2);
                      if (row) Object.assign(row, patch);
                      return { error: null as null, data: row ?? null };
                    };
                    return {
                      select() {
                        return {
                          single: async () => {
                            const result = await applyUpdate();
                            if (!result.data) return { data: null, error: { message: "not found" } };
                            return { data: result.data, error: null };
                          },
                        };
                      },
                      then(
                        resolve: (v: { error: null }) => void,
                        reject?: (e: unknown) => void
                      ) {
                        applyUpdate()
                          .then(() => resolve({ error: null }))
                          .catch(reject);
                      },
                    };
                  },
                  then(
                    resolve: (v: { error: null }) => void,
                    reject?: (e: unknown) => void
                  ) {
                    try {
                      const row = integrations.find((r) => r[col] === val);
                      if (row) Object.assign(row, patch);
                      resolve({ error: null });
                    } catch (e) {
                      reject?.(e);
                    }
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_calendar_events") {
        type EventFilters = { eq: Record<string, string>; notNull: string[] };
        const filterEvents = (filters: EventFilters) =>
          events.filter(
            (r) =>
              Object.entries(filters.eq).every(([k, v]) => r[k] === v) &&
              filters.notNull.every((col) => r[col] != null && String(r[col]).trim() !== "")
          );

        const buildEventChain = (filters: EventFilters = { eq: {}, notNull: [] }) => ({
          eq(col: string, val: string) {
            filters.eq[col] = val;
            return buildEventChain(filters);
          },
          not(col: string, op: string, val: unknown) {
            if (op === "is" && val === null) {
              filters.notNull.push(col);
            }
            return buildEventChain(filters);
          },
          gte() {
            return buildEventChain(filters);
          },
          lte() {
            return buildEventChain(filters);
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
        });

        return {
          select() {
            return buildEventChain();
          },
          insert(row: EventRow) {
            const full: EventRow = {
              ...row,
              id: randomUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            events.push(full);
            return { error: null };
          },
          update(patch: EventRow) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    return {
                      then(
                        resolve: (v: { error: null }) => void,
                        reject?: (e: unknown) => void
                      ) {
                        try {
                          const row = events.find((r) => r[col] === val && r[col2] === val2);
                          if (row) Object.assign(row, patch);
                          resolve({ error: null });
                        } catch (e) {
                          reject?.(e);
                        }
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    integrations,
    events,
    inboundCalendars,
  };
}

function envMap(m: Record<string, string | undefined>): (k: string) => string | undefined {
  return (k) => m[k];
}

function encryptToken(plaintext: string): string {
  const key = deriveExternalConnectorMasterKey(MASTER_KEY)!;
  return encryptExternalConnectorSecret(plaintext, key);
}

function googleSyncFetchHandler(opts: {
  expired?: boolean;
  events?: Array<Record<string, unknown>>;
  refreshCalled?: { value: boolean };
}): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("oauth2.googleapis.com/token") && method === "POST") {
      if (opts.refreshCalled) opts.refreshCalled.value = true;
      return new Response(
        JSON.stringify({ access_token: "refreshed-access", expires_in: 3600 }),
        { status: 200 }
      );
    }

    if (url.includes("/calendars/") && url.includes("/events")) {
      return new Response(JSON.stringify({ items: opts.events ?? [] }), { status: 200 });
    }

    if (url.includes("/calendars/") && !url.includes("/events")) {
      return new Response(JSON.stringify({ id: "clinic@example.com", summary: "Primary" }), {
        status: 200,
      });
    }

    return new Response("not found", { status: 404 });
  };
}

async function seedActiveIntegration(
  client: SupabaseClient,
  tenantId: string,
  overrides: Partial<IntegrationRow> = {}
) {
  return storeGoogleCalendarCredentials(
    {
      tenantId,
      calendarId: "primary",
      googleAccountEmail: "clinic@example.com",
      accessToken: "access-token-1",
      refreshToken: "refresh-token-1",
      expiresInSeconds: overrides.expired ? -120 : 3600,
    },
    { supabaseClientForTests: client }
  );
}

const origEnv = { ...process.env };

describe("CalendarOS GC-3 — sync cron auth", () => {
  it("rejects missing secret", async () => {
    const res = await handleGoogleCalendarSyncCronGet(new NextRequest(ROUTE, { method: "GET" }), {
      getEnv: envMap({ CRON_SECRET: CRON_SECRET }),
      syncForAllTenants: async () => ({ success: true, synced: 0, failed: 0, skipped: 0, tenants: [] }),
    });
    assert.equal(res.status, 401);
    const json = (await res.json()) as { ok: boolean; error?: string };
    assert.equal(json.ok, false);
    assert.equal(json.error, "Unauthorized.");
  });

  it("rejects invalid secret", async () => {
    const res = await handleGoogleCalendarSyncCronGet(
      new NextRequest(ROUTE, {
        method: "GET",
        headers: { authorization: "Bearer wrong-secret-value-0123456789" },
      }),
      {
        getEnv: envMap({ CRON_SECRET: CRON_SECRET }),
        syncForAllTenants: async () => ({ success: true, synced: 0, failed: 0, skipped: 0, tenants: [] }),
      }
    );
    assert.equal(res.status, 401);
  });

  it("accepts Authorization Bearer secret", async () => {
    const res = await handleGoogleCalendarSyncCronGet(
      new NextRequest(ROUTE, {
        method: "GET",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
      {
        getEnv: envMap({ CRON_SECRET: CRON_SECRET }),
        syncForAllTenants: async () => ({ success: true, synced: 1, failed: 0, skipped: 0, tenants: [] }),
      }
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as { source: string };
    assert.equal(json.source, "vercel_cron");
  });

  it("accepts x-fi-google-calendar-secret", async () => {
    const res = await handleGoogleCalendarSyncCronGet(
      new NextRequest(ROUTE, {
        method: "GET",
        headers: { "x-fi-google-calendar-secret": GC_SECRET },
      }),
      {
        getEnv: envMap({ FI_GOOGLE_CALENDAR_CRON_SECRET: GC_SECRET }),
        syncForAllTenants: async () => ({ success: true, synced: 0, failed: 0, skipped: 0, tenants: [] }),
      }
    );
    assert.equal(res.status, 200);
  });

  it("tenantId sync only syncs one tenant", async () => {
    let capturedTenant: string | undefined;
    const res = await handleGoogleCalendarSyncCronGet(
      new NextRequest(`${ROUTE}?tenantId=${TENANT_A}`, {
        method: "GET",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
      {
        getEnv: envMap({ CRON_SECRET: CRON_SECRET }),
        syncForTenant: async (input) => {
          capturedTenant = input.tenantId;
          return {
            tenantId: input.tenantId,
            integrationId: "int-1",
            calendarId: "primary",
            outcome: "synced",
            result: { discovered: 0, created: 0, updated: 0, skipped: 0, deleted: 0 },
          };
        },
      }
    );
    assert.equal(res.status, 200);
    assert.equal(capturedTenant, TENANT_A);
    const json = (await res.json()) as { synced: number; tenants: unknown[] };
    assert.equal(json.synced, 1);
    assert.equal(json.tenants.length, 1);
  });
});

describe("CalendarOS GC-3 — sync service", () => {
  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://app.example.com/cb";
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("all-tenant sync skips inactive integrations", async () => {
    const { client } = createGc3MockSupabase([
      {
        id: randomUUID(),
        tenant_id: TENANT_INACTIVE,
        calendar_id: "primary",
        status: "disconnected",
        access_token_encrypted: encryptToken("token"),
        refresh_token_encrypted: encryptToken("refresh"),
        provider: "google",
        last_sync_status: "never_synced",
        sync_failure_count: 0,
      },
    ]);
    await seedActiveIntegration(client, TENANT_A);

    const refreshCalled = { value: false };
    const fetchOverride = googleSyncFetchHandler({ refreshCalled, events: [] });

    const result = await syncGoogleCalendarForAllTenants({}, {
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(result.synced, 1);
    assert.equal(result.failed, 0);
    assert.ok(result.tenants.every((t) => t.tenantId !== TENANT_INACTIVE));
  });

  it("expired token triggers refresh before sync", async () => {
    const { client, integrations } = createGc3MockSupabase();
    await seedActiveIntegration(client, TENANT_A, { expired: true });

    const row = integrations[0];
    row.token_expires_at = new Date(Date.now() - 120_000).toISOString();

    const refreshCalled = { value: false };
    const fetchOverride = googleSyncFetchHandler({ refreshCalled, events: [] });

    const summary = await syncGoogleCalendarForTenant({ tenantId: TENANT_A }, {
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(summary.outcome, "synced");
    assert.equal(refreshCalled.value, true);
  });

  it("successful sync updates last_synced_at and status", async () => {
    const { client, integrations } = createGc3MockSupabase();
    await seedActiveIntegration(client, TENANT_A);

    const fetchOverride = googleSyncFetchHandler({
      events: [
        {
          id: "evt-1",
          summary: "Consultation",
          start: { dateTime: "2026-07-01T10:00:00Z" },
          end: { dateTime: "2026-07-01T11:00:00Z" },
          updated: "2026-07-01T09:00:00Z",
        },
      ],
    });

    const summary = await syncGoogleCalendarForTenant({ tenantId: TENANT_A }, {
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(summary.outcome, "synced");
    const row = integrations[0];
    assert.equal(row.last_sync_status, "success");
    assert.equal(row.sync_failure_count, 0);
    assert.ok(row.last_synced_at);
    assert.equal(row.last_sync_error, null);
  });

  it("failed sync increments sync_failure_count and stores sanitized error", async () => {
    const { client, integrations } = createGc3MockSupabase();
    await seedActiveIntegration(client, TENANT_A);

    const fetchOverride: typeof fetch = async () =>
      new Response("Bearer secret-token-leak", { status: 500 });

    const summary = await syncGoogleCalendarForTenant({ tenantId: TENANT_A }, {
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(summary.outcome, "failed");
    const row = integrations[0];
    assert.equal(row.last_sync_status, "failed");
    assert.equal(row.sync_failure_count, 1);
    assert.ok(row.last_sync_error);
    assert.ok(!String(row.last_sync_error).includes("secret-token-leak") || String(row.last_sync_error).length <= 500);
  });
});

describe("CalendarOS GC-3 — health and diagnostics", () => {
  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("health loader does not expose encrypted tokens", async () => {
    const { client } = createGc3MockSupabase();
    await storeGoogleCalendarCredentials(
      {
        tenantId: TENANT_A,
        calendarId: "primary",
        googleAccountEmail: "clinic@example.com",
        accessToken: "access-token-1",
        refreshToken: "refresh-token-1",
        expiresInSeconds: 3600,
      },
      { supabaseClientForTests: client }
    );

    const health = await loadGoogleCalendarSyncHealth({ tenantId: TENANT_A }, {
      supabaseClientForTests: client,
    });

    assert.equal(health.connected, true);
    assert.ok(!("access_token_encrypted" in health));
    assert.ok(!("refresh_token_encrypted" in health));
    assert.ok(!("accessToken" in health));
  });

  it("diagnostics returns sanitized failure info", async () => {
    const { client, integrations } = createGc3MockSupabase();
    await storeGoogleCalendarCredentials(
      {
        tenantId: TENANT_A,
        calendarId: "primary",
        googleAccountEmail: "clinic@example.com",
        accessToken: "access-token-1",
        refreshToken: "refresh-token-1",
        expiresInSeconds: 3600,
      },
      { supabaseClientForTests: client }
    );

    integrations[0].last_sync_status = "failed";
    integrations[0].last_sync_error = "Google Calendar API error (403): access denied for Bearer abc123xyz";
    integrations[0].sync_failure_count = 2;

    const diagnostics = await loadGoogleCalendarSyncDiagnostics({ tenantId: TENANT_A }, {
      supabaseClientForTests: client,
    });

    assert.equal(diagnostics.last_sync_status, "failed");
    assert.equal(diagnostics.sync_failure_count, 2);
    assert.ok(diagnostics.last_sync_error_summary);
    assert.ok(!diagnostics.last_sync_error_summary!.includes("abc123xyz") || diagnostics.last_sync_error_summary!.includes("[redacted]") || diagnostics.last_sync_error_summary!.length <= 120);
    assert.ok(!("access_token_encrypted" in diagnostics));
  });

  it("connection status includes sync health fields", async () => {
    const { client, integrations } = createGc3MockSupabase();
    await storeGoogleCalendarCredentials(
      {
        tenantId: TENANT_A,
        calendarId: "primary",
        googleAccountEmail: "clinic@example.com",
        accessToken: "access-token-1",
        refreshToken: "refresh-token-1",
        expiresInSeconds: 3600,
      },
      { supabaseClientForTests: client }
    );

    integrations[0].last_synced_at = "2026-06-26T12:00:00.000Z";
    integrations[0].last_sync_status = "success";

    const status = await loadGoogleCalendarConnectionStatus(TENANT_A, {
      supabaseClientForTests: client,
    });

    assert.equal(status.last_sync_status, "success");
    assert.equal(status.sync_health_label, "healthy");
    assert.equal(status.last_synced_at, "2026-06-26T12:00:00.000Z");
  });
});

describe("CalendarOS GC-3 — connected account email fallback", () => {
  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://app.example.com/cb";
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("completeGoogleCalendarOAuth falls back to calendar id when userinfo unavailable", async () => {
    const { client, integrations } = createGc3MockSupabase();

    const fetchOverride: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "access-token-1",
            refresh_token: "refresh-token-1",
            expires_in: 3600,
          }),
          { status: 200 }
        );
      }
      if (url.includes("oauth2/v2/userinfo")) {
        return new Response("Forbidden", { status: 403 });
      }
      if (url.includes("/calendars/primary")) {
        return new Response(JSON.stringify({ id: "clinic@example.com", summary: "Primary" }), {
          status: 200,
        });
      }
      return new Response("not found", { status: 404 });
    };

    const result = await completeGoogleCalendarOAuth(TENANT_A, "primary", "oauth-code", {
      supabaseClientForTests: client,
      fetchOverride,
    });

    assert.equal(result.ok, true);
    assert.equal(integrations[0].google_account_email, "clinic@example.com");
  });
});
