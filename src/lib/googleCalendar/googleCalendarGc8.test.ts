import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
} from "@/src/lib/onboarding-os/externalConnectorSecretCrypto.server";
import {
  computeExponentialBackoffMs,
  fetchGoogleCalendarWithRetry,
  isGoogleCalendarRateLimitStatus,
} from "./googleCalendarSyncRetryCore";
import {
  deriveGoogleCalendarSyncHealth,
  GOOGLE_CALENDAR_SYNC_AUTO_PAUSE_FAILURE_THRESHOLD,
  GOOGLE_CALENDAR_SYNC_RUN_RETENTION_PER_TENANT,
  isGoogleCalendarSyncDue,
  shouldAutoPauseScheduledSync,
} from "./googleCalendarSyncHealthCore";
import { createGc8MonitoringMockTables, withGc8IntegrationDefaults } from "./googleCalendarGc8MockTables";
import {
  beginGoogleCalendarSyncRun,
  loadGoogleCalendarSyncRunHistory,
  updateGoogleCalendarSyncHealth,
} from "./googleCalendarSyncHealth.server";
import { loadGoogleCalendarMonitoringPage, pauseGoogleCalendarScheduledSync, resumeGoogleCalendarScheduledSync } from "./googleCalendarMonitoring.server";
import { runScheduledGoogleCalendarSync } from "./googleCalendarSyncScheduler.server";
import { syncGoogleCalendarForTenant } from "./googleCalendarSync.server";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INTEGRATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MASTER_KEY = "gc8-test-master-key";

type IntegrationRow = Record<string, unknown>;

function encryptToken(plaintext: string): string {
  const key = deriveExternalConnectorMasterKey(MASTER_KEY)!;
  return encryptExternalConnectorSecret(plaintext, key);
}

function createGc8MockSupabase(seed?: IntegrationRow) {
  const integrations: IntegrationRow[] = [
    withGc8IntegrationDefaults({
      id: INTEGRATION_ID,
      tenant_id: TENANT,
      calendar_id: "primary",
      provider: "google",
      status: "active",
      google_account_email: "clinic@example.com",
      access_token_encrypted: encryptToken("access-token"),
      refresh_token_encrypted: encryptToken("refresh-token"),
      token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      last_sync_status: "never_synced",
      sync_failure_count: 0,
      ...seed,
    }),
  ];
  const events: Record<string, unknown>[] = [];
  const gc8 = createGc8MonitoringMockTables();

  const client = {
    from(table: string) {
      const gc8Handler = gc8.tableHandler(table);
      if (gc8Handler) return gc8Handler;

      if (table === "fi_calendar_integrations") {
        const applyFilters = (
          rows: IntegrationRow[],
          filters: Record<string, string | boolean | { is: null }>
        ) =>
          rows.filter((r) =>
            Object.entries(filters).every(([col, val]) => {
              if (val && typeof val === "object" && "is" in val) return r[col] == null;
              return r[col] === val;
            })
          );

        const buildChain = (filters: Record<string, string | boolean | { is: null }> = {}) => {
          const terminal = {
            maybeSingle: async () => {
              const rows = applyFilters(integrations, filters);
              return { data: rows[0] ?? null, error: null };
            },
            limit(n: number) {
              return {
                maybeSingle: async () => {
                  const rows = applyFilters(integrations, filters).slice(0, n);
                  return { data: rows[0] ?? null, error: null };
                },
              };
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

          return {
            eq(col: string, val: string | boolean) {
              filters[col] = val;
              return buildChain(filters);
            },
            is(col: string, val: null) {
              filters[col] = { is: val };
              return buildChain(filters);
            },
            neq(col: string, val: string) {
              return buildChain(filters);
            },
            order() {
              return { ...buildChain(filters), ...terminal };
            },
            ...terminal,
          };
        };

        return {
          select() {
            return buildChain();
          },
          update(patch: IntegrationRow) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    const row = integrations.find((r) => r[col] === val && r[col2] === val2);
                    if (row) Object.assign(row, patch);
                    return Promise.resolve({ error: null });
                  },
                  then(resolve: (v: { error: null }) => void) {
                    const row = integrations.find((r) => r[col] === val);
                    if (row) Object.assign(row, patch);
                    resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_calendar_inbound_sync_calendars") {
        const inboundRows: Record<string, unknown>[] = [
          {
            id: randomUUID(),
            tenant_id: TENANT,
            integration_id: INTEGRATION_ID,
            google_calendar_id: "primary",
            google_calendar_summary: "Primary",
            is_enabled: true,
            is_primary: true,
          },
        ];
        const buildInbound = (filters: Record<string, unknown> = {}) => ({
          eq(col: string, val: unknown) {
            filters[col] = val;
            return buildInbound(filters);
          },
          order() {
            return {
              order() {
                return Promise.resolve({
                  data: inboundRows.filter((r) =>
                    Object.entries(filters).every(([k, v]) => r[k] === v)
                  ),
                  error: null,
                });
              },
            };
          },
        });
        return {
          select() {
            return buildInbound();
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    const row = inboundRows.find((r) => r[col] === val && r[col2] === val2);
                    if (row) Object.assign(row, patch);
                    return Promise.resolve({ error: null });
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
            if (op === "is" && val === null) filters.notNull.push(col);
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
            resolve: (v: { data: Record<string, unknown>[]; error: null }) => void,
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
          insert(row: Record<string, unknown>) {
            events.push({
              ...row,
              id: randomUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            return { error: null };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    return {
                      then(resolve: (v: { error: null }) => void) {
                        const row = events.find((r) => r[col] === val && r[col2] === val2);
                        if (row) Object.assign(row, patch);
                        resolve({ error: null });
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

  return { client: client as unknown as SupabaseClient, integrations, events, gc8 };
}

function successFetch(): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "refreshed", expires_in: 3600 }), { status: 200 });
    }
    if (url.includes("/calendars/") && url.includes("/events")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (url.includes("/calendars/") && !url.includes("/events")) {
      return new Response(JSON.stringify({ summary: "Primary" }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
}

describe("CalendarOS GC-8 — health core", () => {
  it("transitions to failing at 5 consecutive failures", () => {
    const health = deriveGoogleCalendarSyncHealth({
      consecutiveFailures: 5,
      lastSuccessfulSyncAt: new Date(Date.now() - 60_000).toISOString(),
      lastError: "sync failed",
      tokenInvalid: false,
      manuallyPaused: false,
      autoPaused: false,
    });
    assert.equal(health.healthStatus, "failing");
    assert.equal(shouldAutoPauseScheduledSync(5), true);
  });

  it("marks degraded when token invalid", () => {
    const health = deriveGoogleCalendarSyncHealth({
      consecutiveFailures: 0,
      lastSuccessfulSyncAt: null,
      lastError: "Refresh token not available",
      tokenInvalid: true,
      manuallyPaused: false,
      autoPaused: false,
    });
    assert.equal(health.healthStatus, "degraded");
  });

  it("marks warning when no successful sync in 24h", () => {
    const health = deriveGoogleCalendarSyncHealth({
      consecutiveFailures: 0,
      lastSuccessfulSyncAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      lastError: null,
      tokenInvalid: false,
      manuallyPaused: false,
      autoPaused: false,
    });
    assert.equal(health.healthStatus, "warning");
  });

  it("respects sync frequency due window", () => {
    const now = Date.now();
    const recent = new Date(now - 5 * 60 * 1000).toISOString();
    assert.equal(isGoogleCalendarSyncDue(recent, 15, now), false);
    assert.equal(isGoogleCalendarSyncDue(recent, 5, now), true);
  });
});

describe("CalendarOS GC-8 — retry core", () => {
  it("429 retry path uses exponential backoff", async () => {
    assert.equal(isGoogleCalendarRateLimitStatus(429), true);
    assert.equal(computeExponentialBackoffMs(0), 500);
    assert.equal(computeExponentialBackoffMs(2), 2000);

    let calls = 0;
    const sleeps: number[] = [];
    const fetchFn: typeof fetch = async () => {
      calls += 1;
      if (calls < 3) return new Response("rate limited", { status: 429 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    };

    const result = await fetchGoogleCalendarWithRetry(fetchFn, "https://example.com", { method: "GET" }, {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    assert.equal(result.ok, true);
    assert.equal(calls, 3);
    assert.deepEqual(sleeps, [500, 1000]);
  });
});

describe("CalendarOS GC-8 — scheduled sync + monitoring", () => {
  const prevMaster = process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY;

  beforeEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
  });

  afterEach(() => {
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = prevMaster;
  });

  it("successful scheduled sync updates health metrics and run history", async () => {
    const mock = createGc8MockSupabase();
    const summary = await syncGoogleCalendarForTenant(
      { tenantId: TENANT, source: "scheduled" },
      { supabaseClientForTests: mock.client, fetchOverride: successFetch() }
    );

    assert.equal(summary.outcome, "synced");
    assert.equal(mock.gc8.syncRuns.length, 1);
    assert.equal(mock.gc8.syncRuns[0].status, "success");
    assert.equal(mock.gc8.syncHealth.length, 1);
    assert.equal(mock.gc8.syncHealth[0].consecutive_failures, 0);
    assert.ok(mock.gc8.syncHealth[0].last_successful_sync_at);
  });

  it("failed sync increments consecutive_failures", async () => {
    const mock = createGc8MockSupabase();
    const failFetch: typeof fetch = async () => new Response("fail", { status: 500 });

    const summary = await syncGoogleCalendarForTenant(
      { tenantId: TENANT, source: "manual" },
      { supabaseClientForTests: mock.client, fetchOverride: failFetch }
    );

    assert.equal(summary.outcome, "failed");
    assert.equal(mock.gc8.syncHealth[0].consecutive_failures, 1);
    assert.equal(mock.gc8.syncRuns[0].status, "failed");
    assert.ok(mock.gc8.adminNotifications.some((n) => n.event_type === "google_calendar_sync_failed"));
  });

  it("5 failures pauses scheduled sync", async () => {
    const mock = createGc8MockSupabase();
    const failFetch: typeof fetch = async () => new Response("fail", { status: 500 });

    for (let i = 0; i < GOOGLE_CALENDAR_SYNC_AUTO_PAUSE_FAILURE_THRESHOLD; i += 1) {
      await syncGoogleCalendarForTenant(
        { tenantId: TENANT, source: "manual" },
        { supabaseClientForTests: mock.client, fetchOverride: failFetch }
      );
    }

    assert.equal(mock.gc8.syncHealth[0].consecutive_failures, 5);
    assert.equal(mock.gc8.syncHealth[0].health_status, "failing");
    assert.ok(mock.integrations[0].scheduled_sync_paused_at);
    assert.ok(
      mock.gc8.adminNotifications.some((n) => n.event_type === "google_calendar_sync_paused")
    );
  });

  it("runScheduledGoogleCalendarSync skips tenants not due yet", async () => {
    const mock = createGc8MockSupabase();
    mock.gc8.syncHealth.push({
      id: randomUUID(),
      tenant_id: TENANT,
      integration_id: INTEGRATION_ID,
      provider: "google",
      last_sync_started_at: new Date().toISOString(),
      consecutive_failures: 0,
      total_sync_runs: 1,
      health_score: 100,
      health_status: "healthy",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await runScheduledGoogleCalendarSync(
      {},
      { supabaseClientForTests: mock.client, fetchOverride: successFetch(), nowMs: Date.now() }
    );

    assert.equal(result.skipped, 1);
    assert.equal(result.synced, 0);
  });

  it("sync history retention keeps bounded rows per tenant", async () => {
    const mock = createGc8MockSupabase();
    for (let i = 0; i < GOOGLE_CALENDAR_SYNC_RUN_RETENTION_PER_TENANT + 3; i += 1) {
      const startedAt = new Date(Date.now() - i * 1000).toISOString();
      const { runId } = await beginGoogleCalendarSyncRun(
        { tenantId: TENANT, integrationId: INTEGRATION_ID, source: "scheduled" },
        { supabaseClientForTests: mock.client }
      );
      await updateGoogleCalendarSyncHealth(
        {
          tenantId: TENANT,
          integrationId: INTEGRATION_ID,
          runId,
          startedAt,
          ok: true,
          result: { discovered: 0, created: 0, updated: 0, skipped: 0, deleted: 0 },
        },
        { supabaseClientForTests: mock.client }
      );
    }

    assert.ok(mock.gc8.syncRuns.length <= GOOGLE_CALENDAR_SYNC_RUN_RETENTION_PER_TENANT + 3);
    const history = await loadGoogleCalendarSyncRunHistory(
      { tenantId: TENANT, integrationId: INTEGRATION_ID },
      { supabaseClientForTests: mock.client }
    );
    assert.ok(history.length <= 25);
  });

  it("monitoring dashboard data loader returns health and metrics", async () => {
    const mock = createGc8MockSupabase();
    await syncGoogleCalendarForTenant(
      { tenantId: TENANT, source: "manual" },
      { supabaseClientForTests: mock.client, fetchOverride: successFetch() }
    );

    const page = await loadGoogleCalendarMonitoringPage(TENANT, {
      supabaseClientForTests: mock.client,
      canManage: true,
    });

    assert.equal(page.connected, true);
    assert.equal(page.healthStatus, "healthy");
    assert.equal(page.metrics.totalSyncRuns, 1);
    assert.equal(page.recentRuns.length, 1);
    assert.equal(page.scheduledSyncEnabled, true);
  });

  it("pause and resume scheduled sync controls update integration state", async () => {
    const mock = createGc8MockSupabase();

    const paused = await pauseGoogleCalendarScheduledSync(
      { tenantId: TENANT },
      { supabaseClientForTests: mock.client }
    );
    assert.equal(paused.ok, true);
    assert.ok(mock.integrations[0].scheduled_sync_paused_at);

    const resumed = await resumeGoogleCalendarScheduledSync(
      { tenantId: TENANT },
      { supabaseClientForTests: mock.client }
    );
    assert.equal(resumed.ok, true);
    assert.equal(mock.integrations[0].scheduled_sync_paused_at, null);
  });

  it("alert creation for review queue backlog", async () => {
    const mock = createGc8MockSupabase();
    for (let i = 0; i < 21; i += 1) {
      mock.gc8.reviewItems.push({
        id: randomUUID(),
        tenant_id: TENANT,
        integration_id: INTEGRATION_ID,
        status: "open",
      });
    }

    const startedAt = new Date().toISOString();
    const { runId } = await beginGoogleCalendarSyncRun(
      { tenantId: TENANT, integrationId: INTEGRATION_ID, source: "manual" },
      { supabaseClientForTests: mock.client }
    );

    await updateGoogleCalendarSyncHealth(
      {
        tenantId: TENANT,
        integrationId: INTEGRATION_ID,
        runId,
        startedAt,
        ok: false,
        error: "partial failure",
      },
      { supabaseClientForTests: mock.client }
    );

    assert.ok(
      mock.gc8.adminNotifications.some(
        (n) => n.title === "Google Calendar review queue backlog"
      )
    );
  });
});
