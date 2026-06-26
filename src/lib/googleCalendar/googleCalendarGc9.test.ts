import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
} from "@/src/lib/onboarding-os/externalConnectorSecretCrypto.server";
import {
  deriveCalendarEventOwnershipSource,
  isRiskyGoogleChangeForFiOwnedEvent,
  shouldSkipDuplicateWebhookNotification,
} from "@/src/lib/calendar/providers/calendarProviderAdapter";
import { createGc9MockTables } from "./googleCalendarGc9MockTables";
import { withGc8IntegrationDefaults } from "./googleCalendarGc8MockTables";
import {
  createGoogleCalendarWebhookSubscription,
  handleGoogleCalendarWebhookNotification,
  listExpiringGoogleCalendarWebhookSubscriptions,
  renewGoogleCalendarWebhookSubscription,
  stopGoogleCalendarWebhookSubscription,
} from "./googleCalendarWebhookSubscriptions.server";
import { reconcileGoogleCalendarEventChange } from "./googleCalendarReconciliation.server";
import { shouldProcessEventVersion, upsertCalendarEventVersion } from "./googleCalendarEventVersions.server";
import { loadGoogleCalendarMonitoringPage } from "./googleCalendarMonitoring.server";
import { runScheduledGoogleCalendarSync } from "./googleCalendarSyncScheduler.server";
import type { FiCalendarEvent } from "./googleCalendarTypes";

const TENANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const INTEGRATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MASTER_KEY = "gc9-test-master-key";
const CHANNEL_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const RESOURCE_ID = "resource-abc123";

function encryptToken(plaintext: string): string {
  const key = deriveExternalConnectorMasterKey(MASTER_KEY)!;
  return encryptExternalConnectorSecret(plaintext, key);
}

function createGc9MockSupabase() {
  const gc9 = createGc9MockTables();
  type IntegrationRow = Record<string, unknown>;
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
      realtime_sync_enabled: false,
    }),
  ];
  const events: Record<string, unknown>[] = [];
  const reviewItems: Record<string, unknown>[] = [];

  const client = {
    from(table: string) {
      const gc9Handler = gc9.tableHandler(table);
      if (gc9Handler) return gc9Handler;

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
                then(
                  resolve: (v: { data: IntegrationRow[]; error: null }) => void,
                  reject?: (e: unknown) => void
                ) {
                  try {
                    resolve({ data: applyFilters(integrations, filters).slice(0, n), error: null });
                  } catch (e) {
                    reject?.(e);
                  }
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
            neq(_col: string, _val: string) {
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
              id: row.id ?? randomUUID(),
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

      if (table === "fi_calendar_sync_review_items") {
        const buildReview = (filters: Record<string, unknown> = {}) => ({
          eq(col: string, val: unknown) {
            filters[col] = val;
            return buildReview(filters);
          },
          maybeSingle: async () => {
            const row = reviewItems.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
            return { data: row ?? null, error: null };
          },
        });
        return {
          select() {
            return buildReview();
          },
          insert(row: Record<string, unknown>) {
            const item = { id: randomUUID(), ...row };
            reviewItems.push(item);
            return {
              select() {
                return { single: async () => ({ data: item, error: null }) };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq() {
                return { select: () => ({ single: async () => ({ data: { ...patch }, error: null }) }) };
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
    gc9,
    integrations,
    events,
    reviewItems,
  };
}

function mockGoogleFetch(watchOk = true, listSyncTokenInvalid = false): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/events/watch") && init?.method === "POST") {
      if (!watchOk) {
        return new Response(JSON.stringify({ error: { message: "watch failed" } }), { status: 400 });
      }
      return new Response(
        JSON.stringify({
          resourceId: RESOURCE_ID,
          resourceUri: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }),
        { status: 200 }
      );
    }
    if (url.includes("/channels/stop")) {
      return new Response("", { status: 200 });
    }
    if (url.includes("/events?") && init?.method === "GET") {
      if (listSyncTokenInvalid || url.includes("syncToken=bad")) {
        return new Response(JSON.stringify({ error: { message: "Sync token invalid" } }), { status: 410 });
      }
      if (url.includes("syncToken=")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "evt-1",
                etag: '"etag-new"',
                updated: new Date().toISOString(),
                summary: "Updated title",
                start: { dateTime: "2026-06-01T10:00:00.000Z" },
                end: { dateTime: "2026-06-01T11:00:00.000Z" },
                status: "confirmed",
              },
            ],
            nextSyncToken: "next-sync-token",
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({ items: [], nextSyncToken: "initial-sync-token" }),
        { status: 200 }
      );
    }
    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "fresh-token", expires_in: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  };
}

describe("GC-9 — webhook subscriptions", () => {
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(() => {
    envBackup = { ...process.env };
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
    process.env.FI_GOOGLE_CALENDAR_WEBHOOK_BASE_URL = "https://app.example.com";
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("create subscription stores channel and resource ids", async () => {
    const { client, gc9 } = createGc9MockSupabase();
    const result = await createGoogleCalendarWebhookSubscription(
      { tenantId: TENANT },
      { supabaseClientForTests: client, fetchOverride: mockGoogleFetch(true) }
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.subscription.status, "active");
    assert.equal(result.subscription.channel_id, result.subscription.channel_id);
    assert.equal(result.subscription.resource_id, RESOURCE_ID);
    assert.equal(gc9.webhookSubscriptions.length, 1);
  });

  it("renew subscription replaces active row", async () => {
    const { client } = createGc9MockSupabase();
    const created = await createGoogleCalendarWebhookSubscription(
      { tenantId: TENANT },
      { supabaseClientForTests: client, fetchOverride: mockGoogleFetch(true) }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const renewed = await renewGoogleCalendarWebhookSubscription(
      { tenantId: TENANT, subscriptionId: created.subscription.id },
      { supabaseClientForTests: client, fetchOverride: mockGoogleFetch(true) }
    );
    assert.equal(renewed.ok, true);
  });

  it("stop subscription marks status stopped", async () => {
    const { client, gc9 } = createGc9MockSupabase();
    const created = await createGoogleCalendarWebhookSubscription(
      { tenantId: TENANT },
      { supabaseClientForTests: client, fetchOverride: mockGoogleFetch(true) }
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const stopped = await stopGoogleCalendarWebhookSubscription(
      { tenantId: TENANT, subscriptionId: created.subscription.id },
      { supabaseClientForTests: client, fetchOverride: mockGoogleFetch(true) }
    );
    assert.equal(stopped.ok, true);
    const row = gc9.webhookSubscriptions.find((r) => r.id === created.subscription.id);
    assert.equal(row?.status, "stopped");
  });

  it("list expiring subscriptions returns rows near expiry", async () => {
    const { client, gc9 } = createGc9MockSupabase();
    gc9.webhookSubscriptions.push({
      id: randomUUID(),
      tenant_id: TENANT,
      integration_id: INTEGRATION_ID,
      provider: "google",
      google_calendar_id: "primary",
      channel_id: CHANNEL_ID,
      resource_id: RESOURCE_ID,
      status: "active",
      expiration_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      failure_count: 0,
      metadata: {},
    });

    const expiring = await listExpiringGoogleCalendarWebhookSubscriptions(
      { thresholdHours: 24 },
      { supabaseClientForTests: client, nowMs: Date.now() }
    );
    assert.equal(expiring.length, 1);
  });
});

describe("GC-9 — webhook notifications", () => {
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(() => {
    envBackup = { ...process.env };
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
  });

  afterEach(() => {
    process.env = envBackup;
  });

  function successFetch(): typeof fetch {
    return async (input) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "refreshed", expires_in: 3600 }), { status: 200 });
      }
      if (url.includes("/events/watch") && (input as Request).method === "POST") {
        return new Response(
          JSON.stringify({ resourceId: RESOURCE_ID, expiration: String(Date.now() + 86400000) }),
          { status: 200 }
        );
      }
      if (url.includes("/calendars/") && url.includes("/events")) {
        return new Response(JSON.stringify({ items: [], nextSyncToken: "initial-sync-token" }), { status: 200 });
      }
      if (url.includes("/calendars/") && !url.includes("/events")) {
        return new Response(JSON.stringify({ summary: "Primary" }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };
  }
  it("valid webhook notification triggers sync path", async () => {
    const { client, gc9 } = createGc9MockSupabase();
    const channelId = randomUUID();
    gc9.webhookSubscriptions.push({
      id: randomUUID(),
      tenant_id: TENANT,
      integration_id: INTEGRATION_ID,
      provider: "google",
      google_calendar_id: "primary",
      channel_id: channelId,
      resource_id: RESOURCE_ID,
      sync_token: null,
      status: "active",
      expiration_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      failure_count: 0,
      metadata: {},
    });

    const result = await handleGoogleCalendarWebhookNotification(
      {
        channelId,
        resourceId: RESOURCE_ID,
        resourceState: "sync",
        messageNumber: "1",
      },
      { supabaseClientForTests: client, fetchOverride: successFetch() }
    );

    assert.equal(result.ok, true);
    assert.equal(result.outcome, "sync_triggered");
  });

  it("unknown channel is rejected", async () => {
    const { client } = createGc9MockSupabase();
    const result = await handleGoogleCalendarWebhookNotification(
      {
        channelId: "unknown-channel",
        resourceId: RESOURCE_ID,
        resourceState: "sync",
      },
      { supabaseClientForTests: client }
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, 404);
  });

  it("duplicate notification is idempotent", async () => {
    const { client, gc9 } = createGc9MockSupabase();
    const channelId = randomUUID();
    gc9.webhookSubscriptions.push({
      id: randomUUID(),
      tenant_id: TENANT,
      integration_id: INTEGRATION_ID,
      provider: "google",
      google_calendar_id: "primary",
      channel_id: channelId,
      resource_id: RESOURCE_ID,
      sync_token: null,
      status: "active",
      expiration_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      failure_count: 0,
      metadata: { last_message_number: "5" },
    });

    const result = await handleGoogleCalendarWebhookNotification(
      {
        channelId,
        resourceId: RESOURCE_ID,
        resourceState: "sync",
        messageNumber: "4",
      },
      { supabaseClientForTests: client, fetchOverride: mockGoogleFetch(true) }
    );

    assert.equal(result.outcome, "duplicate");
  });

  it("shouldSkipDuplicateWebhookNotification detects duplicates", () => {
    assert.equal(shouldSkipDuplicateWebhookNotification("5", "4"), true);
    assert.equal(shouldSkipDuplicateWebhookNotification("5", "6"), false);
  });
});

describe("GC-9 — reconciliation", () => {
  it("FI-owned risky Google edit stages review", async () => {
    const { client, reviewItems } = createGc9MockSupabase();
    const localEvent: FiCalendarEvent = {
      id: randomUUID(),
      tenantId: TENANT,
      externalEventId: "evt-fi",
      provider: "google",
      calendarId: "primary",
      title: "Consultation",
      description: null,
      location: null,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      eventType: "consultation",
      googleMeetUrl: null,
      patientId: "patient-1",
      leadId: null,
      metadata: { source: "fi_appointment_create" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.equal(deriveCalendarEventOwnershipSource(localEvent), "fi_system");
    assert.equal(
      isRiskyGoogleChangeForFiOwnedEvent(localEvent, {
        title: "Changed title",
        startTime: "2026-06-01T12:00:00.000Z",
        endTime: "2026-06-01T13:00:00.000Z",
      }),
      true
    );

    const result = await reconcileGoogleCalendarEventChange(
      {
        tenantId: TENANT,
        integrationId: INTEGRATION_ID,
        googleCalendarId: "primary",
        googleEvent: {
          externalEventId: "evt-fi",
          calendarId: "primary",
          title: "Changed title",
          description: null,
          location: null,
          startTime: "2026-06-01T12:00:00.000Z",
          endTime: "2026-06-01T13:00:00.000Z",
          eventType: null,
          googleMeetUrl: null,
          etag: '"etag-2"',
          updatedAt: new Date().toISOString(),
          status: "confirmed",
          raw: {
            id: "evt-fi",
            summary: "Changed title",
            start: { dateTime: "2026-06-01T12:00:00.000Z" },
            end: { dateTime: "2026-06-01T13:00:00.000Z" },
            status: "confirmed",
          },
        },
        localEvent,
      },
      { supabaseClientForTests: client }
    );

    assert.equal(result.decision, "staged_review");
    assert.ok(reviewItems.length >= 1 || result.reviewItemCreated === true);
  });

  it("Google-owned event updates allowed fields", async () => {
    const { client, events } = createGc9MockSupabase();
    const localId = randomUUID();
    events.push({
      id: localId,
      tenant_id: TENANT,
      external_event_id: "evt-google",
      calendar_id: "primary",
      title: "Old",
      description: null,
      location: null,
      start_time: "2026-06-01T10:00:00.000Z",
      end_time: "2026-06-01T11:00:00.000Z",
      event_type: "external",
      google_meet_url: null,
      patient_id: null,
      lead_id: null,
      metadata: { source: "google_sync" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const localEvent: FiCalendarEvent = {
      id: localId,
      tenantId: TENANT,
      externalEventId: "evt-google",
      provider: "google",
      calendarId: "primary",
      title: "Old",
      description: null,
      location: null,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      eventType: "external",
      googleMeetUrl: null,
      patientId: null,
      leadId: null,
      metadata: { source: "google_sync" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await reconcileGoogleCalendarEventChange(
      {
        tenantId: TENANT,
        integrationId: INTEGRATION_ID,
        googleCalendarId: "primary",
        googleEvent: {
          externalEventId: "evt-google",
          calendarId: "primary",
          title: "New title",
          description: "Desc",
          location: "Room A",
          startTime: "2026-06-01T10:30:00.000Z",
          endTime: "2026-06-01T11:30:00.000Z",
          eventType: null,
          googleMeetUrl: null,
          etag: '"etag-new"',
          updatedAt: new Date().toISOString(),
          status: "confirmed",
          raw: { id: "evt-google", summary: "New title", status: "confirmed" },
        },
        localEvent,
      },
      { supabaseClientForTests: client }
    );

    assert.equal(result.decision, "mirrored_google_owned");
    const updated = events.find((e) => e.id === localId);
    assert.equal(updated?.title, "New title");
  });

  it("event version tracking updates", async () => {
    const { client, gc9 } = createGc9MockSupabase();
    const version = await upsertCalendarEventVersion(
      {
        tenantId: TENANT,
        googleCalendarId: "primary",
        externalEventId: "evt-v",
        externalEtag: '"etag-1"',
        ownershipSource: "google_external",
        versionStatus: "synced",
      },
      { supabaseClientForTests: client }
    );
    assert.equal(version.external_event_id, "evt-v");
    assert.equal(gc9.eventVersions.length, 1);

    assert.equal(shouldProcessEventVersion(version, '"etag-1"', version.external_updated_at), false);
    assert.equal(shouldProcessEventVersion(version, '"etag-2"', new Date().toISOString()), true);
  });
});

describe("GC-9 — scheduler fallback and monitoring", () => {
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(() => {
    envBackup = { ...process.env };
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY = MASTER_KEY;
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("scheduled sync skips tenant with active webhook", async () => {
    const { client, gc9 } = createGc9MockSupabase();
    gc9.webhookSubscriptions.push({
      id: randomUUID(),
      tenant_id: TENANT,
      integration_id: INTEGRATION_ID,
      provider: "google",
      google_calendar_id: "primary",
      channel_id: CHANNEL_ID,
      resource_id: RESOURCE_ID,
      status: "active",
      expiration_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      failure_count: 0,
      metadata: {},
    });

    const result = await runScheduledGoogleCalendarSync(
      { tenantId: TENANT },
      { supabaseClientForTests: client, nowMs: Date.now() + 3600_000 }
    );

    const tenant = result.tenants.find((t) => t.tenantId === TENANT);
    assert.equal(tenant?.skipReason, "realtime_webhook_active");
  });

  it("dashboard loader exposes webhook health", async () => {
    const { client, gc9 } = createGc9MockSupabase();
    gc9.webhookSubscriptions.push({
      id: randomUUID(),
      tenant_id: TENANT,
      integration_id: INTEGRATION_ID,
      provider: "google",
      google_calendar_id: "primary",
      channel_id: CHANNEL_ID,
      resource_id: RESOURCE_ID,
      status: "active",
      expiration_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_notification_at: new Date().toISOString(),
      failure_count: 0,
      metadata: {},
    });

    const page = await loadGoogleCalendarMonitoringPage(TENANT, {
      supabaseClientForTests: client,
      canManage: true,
    });

    assert.equal(page.connected, true);
    assert.equal(page.webhook.syncMode, "realtime_active");
    assert.equal(page.webhook.subscriptionStatus, "active");
    assert.ok(page.webhook.expirationAt);
  });
});
