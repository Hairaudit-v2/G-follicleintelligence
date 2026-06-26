import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, beforeEach } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  publishFiEvent,
  FiEventValidationError,
} from "@/src/lib/events/fiEventPublisher.server";
import {
  computeFiEventRetryDelayMs,
  processFiEventDeliveries,
  retryFailedFiEventDeliveries,
} from "@/src/lib/events/fiEventProcessor.server";
import { loadFiEventBusHealthForTenant } from "@/src/lib/events/fiEventBusHealth.server";
import { createFiEventBusMockTables } from "@/src/lib/events/fiEventBusMockTables";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createMockClient() {
  const bus = createFiEventBusMockTables();

  const client = {
    from(table: string) {
      const handler = bus.tableHandler(table);
      if (handler) return handler;
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  return { client, bus };
}

function seedGlobalAnalyticsSubscriber(bus: ReturnType<typeof createFiEventBusMockTables>) {
  bus.subscribers.push({
    id: randomUUID(),
    tenant_id: null,
    subscriber_key: "analytics-calendar-sync-started",
    source_module: "calendar_os",
    event_name: "calendar.sync.started",
    target_module: "analytics_os",
    handler_key: "analytics.calendarEventCaptured",
    is_enabled: true,
    retry_limit: 3,
    metadata: {},
  });
}

describe("fiEventBus", () => {
  let client: SupabaseClient;
  let bus: ReturnType<typeof createFiEventBusMockTables>;

  beforeEach(() => {
    const mock = createMockClient();
    client = mock.client;
    bus = mock.bus;
    bus.setAnalyticsInsertShouldFail(false);
  });

  it("publishes a registered event", async () => {
    seedGlobalAnalyticsSubscriber(bus);

    const result = await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.sync.started",
        sourceModule: "calendar_os",
        payload: { source: "manual" },
      },
      { supabaseClientForTests: client }
    );

    assert.equal(result.ok, true);
    assert.equal(bus.events.length, 1);
    assert.equal(bus.deliveries.length, 1);
  });

  it("rejects unknown event", async () => {
    const result = await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "unknown.event",
        sourceModule: "calendar_os",
      },
      { supabaseClientForTests: client, strict: true }
    ).catch((e) => e);

    assert.ok(result instanceof FiEventValidationError);
  });

  it("idempotency key prevents duplicate event", async () => {
    seedGlobalAnalyticsSubscriber(bus);

    const metadata = { idempotencyKey: "sync-run-123" };
    const first = await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.sync.started",
        sourceModule: "calendar_os",
        metadata,
      },
      { supabaseClientForTests: client }
    );
    const second = await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.sync.started",
        sourceModule: "calendar_os",
        metadata,
      },
      { supabaseClientForTests: client }
    );

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(second.duplicate, true);
      assert.equal(first.eventId, second.eventId);
    }
    assert.equal(bus.events.length, 1);
  });

  it("global subscriber receives event", async () => {
    seedGlobalAnalyticsSubscriber(bus);

    await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.sync.started",
        sourceModule: "calendar_os",
      },
      { supabaseClientForTests: client }
    );

    assert.equal(bus.deliveries.length, 1);
    assert.equal(bus.deliveries[0]?.subscriber_key, "analytics-calendar-sync-started");
  });

  it("tenant subscriber receives event", async () => {
    bus.subscribers.push({
      id: randomUUID(),
      tenant_id: TENANT,
      subscriber_key: "tenant-custom",
      source_module: "calendar_os",
      event_name: "calendar.sync.completed",
      target_module: "analytics_os",
      handler_key: "analytics.calendarEventCaptured",
      is_enabled: true,
      retry_limit: 3,
      metadata: {},
    });

    await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.sync.completed",
        sourceModule: "calendar_os",
      },
      { supabaseClientForTests: client }
    );

    assert.equal(bus.deliveries.length, 1);
    assert.equal(bus.deliveries[0]?.tenant_id, TENANT);
  });

  it("disabled subscriber ignored", async () => {
    bus.subscribers.push({
      id: randomUUID(),
      tenant_id: null,
      subscriber_key: "disabled-sub",
      source_module: "calendar_os",
      event_name: "calendar.sync.started",
      target_module: "analytics_os",
      handler_key: "analytics.calendarEventCaptured",
      is_enabled: false,
      retry_limit: 3,
      metadata: {},
    });

    await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.sync.started",
        sourceModule: "calendar_os",
      },
      { supabaseClientForTests: client }
    );

    assert.equal(bus.deliveries.length, 0);
    assert.equal(bus.events[0]?.processing_status, "processed");
  });

  it("delivery success marks delivery delivered and event processed", async () => {
    seedGlobalAnalyticsSubscriber(bus);

    const published = await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.sync.started",
        sourceModule: "calendar_os",
      },
      { supabaseClientForTests: client }
    );

    assert.equal(published.ok, true);
    const result = await processFiEventDeliveries({ supabaseClientForTests: client });
    assert.equal(result.delivered, 1);
    assert.equal(bus.deliveries[0]?.status, "delivered");
    assert.equal(bus.events[0]?.processing_status, "processed");
    assert.equal(bus.analyticsEvents.length, 1);
  });

  it("delivery failure schedules retry", async () => {
    bus.subscribers.push({
      id: randomUUID(),
      tenant_id: null,
      subscriber_key: "test-fail",
      source_module: "calendar_os",
      event_name: "calendar.sync.failed",
      target_module: "test_os",
      handler_key: "test.alwaysFails",
      is_enabled: true,
      retry_limit: 3,
      metadata: {},
    });

    await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.sync.failed",
        sourceModule: "calendar_os",
      },
      { supabaseClientForTests: client }
    );

    await processFiEventDeliveries({ supabaseClientForTests: client });
    assert.equal(bus.deliveries[0]?.status, "pending");
    assert.equal(bus.deliveries[0]?.attempt_count, 1);
    assert.ok(bus.deliveries[0]?.next_attempt_at);
  });

  it("exhausted retry marks delivery failed and event failed", async () => {
    bus.subscribers.push({
      id: randomUUID(),
      tenant_id: null,
      subscriber_key: "test-fail",
      source_module: "calendar_os",
      event_name: "calendar.sync.failed",
      target_module: "test_os",
      handler_key: "test.alwaysFails",
      is_enabled: true,
      retry_limit: 1,
      metadata: {},
    });

    await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.sync.failed",
        sourceModule: "calendar_os",
      },
      { supabaseClientForTests: client }
    );

    await processFiEventDeliveries({ supabaseClientForTests: client });
    assert.equal(bus.deliveries[0]?.status, "failed");
    assert.equal(bus.events[0]?.processing_status, "failed");
  });

  it("event status processed when all deliveries complete", async () => {
    bus.subscribers.push(
      {
        id: randomUUID(),
        tenant_id: null,
        subscriber_key: "analytics-a",
        source_module: "calendar_os",
        event_name: "calendar.sync.completed",
        target_module: "analytics_os",
        handler_key: "analytics.calendarEventCaptured",
        is_enabled: true,
        retry_limit: 3,
        metadata: {},
      },
      {
        id: randomUUID(),
        tenant_id: null,
        subscriber_key: "audit-webhook",
        source_module: "calendar_os",
        event_name: "calendar.webhook.received",
        target_module: "audit_os",
        handler_key: "audit.calendarWebhookReceived",
        is_enabled: true,
        retry_limit: 3,
        metadata: {},
      }
    );

    await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.webhook.received",
        sourceModule: "calendar_os",
        payload: { integrationId: randomUUID(), channelId: "ch-1", resourceState: "exists" },
      },
      { supabaseClientForTests: client }
    );

    await processFiEventDeliveries({ supabaseClientForTests: client });
    assert.equal(bus.events[0]?.processing_status, "processed");
    assert.ok(bus.deliveries.every((d) => d.status === "delivered" || d.status === "skipped"));
  });

  it("retryFailedFiEventDeliveries processes eligible failed rows", async () => {
    bus.subscribers.push({
      id: randomUUID(),
      tenant_id: null,
      subscriber_key: "test-fail-retry",
      source_module: "calendar_os",
      event_name: "calendar.sync.failed",
      target_module: "test_os",
      handler_key: "test.alwaysFails",
      is_enabled: true,
      retry_limit: 3,
      metadata: {},
    });

    await publishFiEvent(
      {
        tenantId: TENANT,
        eventName: "calendar.sync.failed",
        sourceModule: "calendar_os",
      },
      { supabaseClientForTests: client }
    );
    await processFiEventDeliveries({ supabaseClientForTests: client, nowMs: Date.now() });

    bus.deliveries[0]!.status = "failed";
    bus.deliveries[0]!.handler_key = "analytics.calendarEventCaptured";
    bus.deliveries[0]!.next_attempt_at = new Date(Date.now() - 1000).toISOString();

    const retried = await retryFailedFiEventDeliveries({
      supabaseClientForTests: client,
      nowMs: Date.now(),
    });

    assert.equal(retried.retried, 1);
    assert.equal(retried.delivered, 1);
  });

  it("computeFiEventRetryDelayMs uses exponential backoff", () => {
    assert.equal(computeFiEventRetryDelayMs(1), 30_000);
    assert.equal(computeFiEventRetryDelayMs(2), 60_000);
    assert.ok(computeFiEventRetryDelayMs(10) <= 3_600_000);
  });

  it("loadFiEventBusHealthForTenant is tenant scoped", async () => {
    bus.events.push(
      {
        id: randomUUID(),
        tenant_id: TENANT,
        event_name: "calendar.sync.started",
        occurred_at: new Date().toISOString(),
        processing_status: "processed",
      },
      {
        id: randomUUID(),
        tenant_id: TENANT_B,
        event_name: "calendar.sync.started",
        occurred_at: new Date().toISOString(),
        processing_status: "processed",
      }
    );

    const health = await loadFiEventBusHealthForTenant(TENANT, {
      supabaseClientForTests: client,
    });

    assert.equal(health.emittedLast24h, 1);
    assert.equal(health.healthStatus, "healthy");
  });
});
