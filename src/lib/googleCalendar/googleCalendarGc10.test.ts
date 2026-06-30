import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
} from "@/src/lib/onboarding-os/externalConnectorSecretCrypto.server";
import { createGc9MockSupabase } from "./googleCalendarGc9MockSupabase";
import { syncGoogleCalendarForTenant } from "./googleCalendarSync.server";
import {
  createGoogleCalendarWebhookSubscription,
  handleGoogleCalendarWebhookNotification,
} from "./googleCalendarWebhookSubscriptions.server";
import { reconcileGoogleCalendarEventChange } from "./googleCalendarReconciliation.server";
import { upsertGoogleCalendarSyncReviewItem } from "./googleCalendarSyncReview.server";
import { detectGoogleCalendarSyncConflict } from "./googleCalendarSyncReviewCore";
import type { FiCalendarEvent } from "./googleCalendarTypes";

const TENANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const INTEGRATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MASTER_KEY = "gc10-test-master-key";
const RESOURCE_ID = "resource-gc10";

function encryptToken(plaintext: string): string {
  const key = deriveExternalConnectorMasterKey(MASTER_KEY)!;
  return encryptExternalConnectorSecret(plaintext, key);
}

function createGc10MockSupabase(opts?: { eventsInsertShouldFail?: boolean }) {
  const mock = createGc9MockSupabase({
    tenantId: TENANT,
    integrationId: INTEGRATION_ID,
    encryptToken,
  });
  if (opts?.eventsInsertShouldFail) {
    mock.eventBus.setEventsInsertShouldFail(true);
  }
  return mock;
}

function successFetch(): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "refreshed", expires_in: 3600 }), {
        status: 200,
      });
    }
    if (url.includes("/events/watch") && (input as Request).method === "POST") {
      return new Response(
        JSON.stringify({ resourceId: RESOURCE_ID, expiration: String(Date.now() + 86400000) }),
        { status: 200 }
      );
    }
    if (url.includes("/calendars/") && url.includes("/events")) {
      return new Response(JSON.stringify({ items: [], nextSyncToken: "token" }), { status: 200 });
    }
    if (url.includes("/calendars/") && !url.includes("/events")) {
      return new Response(JSON.stringify({ summary: "Primary" }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
}

function failFetch(): typeof fetch {
  return async () => new Response("upstream failure", { status: 500 });
}

describe("CalendarOS GC-10 — event bus integration", () => {
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

  it("manual sync emits sync started and completed", async () => {
    const mock = createGc10MockSupabase();
    const summary = await syncGoogleCalendarForTenant(
      { tenantId: TENANT, source: "manual" },
      { supabaseClientForTests: mock.client, fetchOverride: successFetch() }
    );

    assert.equal(summary.outcome, "synced");
    const names = mock.eventBus.events.map((e) => e.event_name);
    assert.ok(names.includes("calendar.sync.started"));
    assert.ok(names.includes("calendar.sync.completed"));
  });

  it("failed sync emits sync.failed", async () => {
    const mock = createGc10MockSupabase();
    const summary = await syncGoogleCalendarForTenant(
      { tenantId: TENANT, source: "manual" },
      { supabaseClientForTests: mock.client, fetchOverride: failFetch() }
    );

    assert.equal(summary.outcome, "failed");
    assert.ok(mock.eventBus.events.some((e) => e.event_name === "calendar.sync.failed"));
  });

  it("webhook notification emits webhook.received", async () => {
    const mock = createGc10MockSupabase();
    const channelId = randomUUID();
    mock.gc9.webhookSubscriptions.push({
      id: randomUUID(),
      tenant_id: TENANT,
      integration_id: INTEGRATION_ID,
      provider: "google",
      google_calendar_id: "primary",
      channel_id: channelId,
      resource_id: RESOURCE_ID,
      sync_token: null,
      status: "active",
      expiration_at: new Date(Date.now() + 86400000).toISOString(),
      failure_count: 0,
      metadata: {},
    });

    const result = await handleGoogleCalendarWebhookNotification(
      { channelId, resourceId: RESOURCE_ID, resourceState: "sync", messageNumber: "99" },
      { supabaseClientForTests: mock.client, fetchOverride: successFetch() }
    );

    assert.equal(result.ok, true);
    assert.ok(mock.eventBus.events.some((e) => e.event_name === "calendar.webhook.received"));
  });

  it("subscription creation emits subscription.created", async () => {
    const mock = createGc10MockSupabase();
    const result = await createGoogleCalendarWebhookSubscription(
      { tenantId: TENANT },
      { supabaseClientForTests: mock.client, fetchOverride: successFetch() }
    );

    assert.equal(result.ok, true);
    assert.ok(
      mock.eventBus.events.some((e) => e.event_name === "calendar.webhook.subscription.created")
    );
  });

  it("reconciliation conflict emits conflict_detected", async () => {
    const mock = createGc10MockSupabase();
    const localId = randomUUID();
    const localEvent: FiCalendarEvent = {
      id: localId,
      tenantId: TENANT,
      externalEventId: "evt-fi-owned",
      provider: "google",
      calendarId: "primary",
      title: "Consultation",
      description: null,
      location: null,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      eventType: "consultation",
      googleMeetUrl: null,
      patientId: randomUUID(),
      leadId: null,
      metadata: { ownershipSource: "fi_system" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mock.events.push({
      id: localId,
      tenant_id: TENANT,
      external_event_id: "evt-fi-owned",
      title: "Consultation",
      metadata: { ownershipSource: "fi_system" },
    });

    await reconcileGoogleCalendarEventChange(
      {
        tenantId: TENANT,
        integrationId: INTEGRATION_ID,
        googleCalendarId: "primary",
        googleEvent: {
          externalEventId: "evt-fi-owned",
          calendarId: "primary",
          title: "Changed title",
          description: "Changed",
          location: "Room 2",
          startTime: "2026-06-01T10:30:00.000Z",
          endTime: "2026-06-01T11:30:00.000Z",
          eventType: null,
          googleMeetUrl: null,
          etag: '"etag-conflict"',
          updatedAt: new Date().toISOString(),
          status: "confirmed",
          raw: { id: "evt-fi-owned", summary: "Changed title", status: "confirmed" },
        },
        localEvent,
      },
      { supabaseClientForTests: mock.client }
    );

    assert.ok(
      mock.eventBus.events.some((e) => e.event_name === "calendar.reconciliation.conflict_detected")
    );
  });

  it("GC-7 review staging emits review_item.created", async () => {
    const mock = createGc10MockSupabase();
    const googleEvent = {
      id: "evt-review",
      summary: "   ",
      status: "confirmed",
      start: { dateTime: "2026-06-02T09:00:00Z" },
      end: { dateTime: "2026-06-02T10:00:00Z" },
    };
    const detection = detectGoogleCalendarSyncConflict({
      googleEvent,
      calendarId: "primary",
      calendarSummary: "Primary",
      accessRole: "reader",
      existingByExternalId: null,
      localEvents: [],
    });
    assert.ok(detection);

    const result = await upsertGoogleCalendarSyncReviewItem(
      {
        tenantId: TENANT,
        integrationId: INTEGRATION_ID,
        googleCalendarId: "primary",
        googleCalendarSummary: "Primary",
        externalEventId: "evt-review",
        googleEvent,
        detection,
      },
      { supabaseClientForTests: mock.client }
    );

    assert.equal(result.ok, true);
    assert.ok(mock.eventBus.events.some((e) => e.event_name === "calendar.review_item.created"));
  });

  it("event bus failure does not break sync", async () => {
    const mock = createGc10MockSupabase({ eventsInsertShouldFail: true });
    const summary = await syncGoogleCalendarForTenant(
      { tenantId: TENANT, source: "manual" },
      { supabaseClientForTests: mock.client, fetchOverride: successFetch() }
    );

    assert.equal(summary.outcome, "synced");
    assert.equal(mock.eventBus.events.length, 0);
    assert.equal(mock.gc9.gc8.syncRuns.length, 1);
  });
});
