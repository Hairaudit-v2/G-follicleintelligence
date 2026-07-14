import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveFiEventIngestionGate,
  tryReclaimStaleFiEventProcessing,
} from "./fiEventIngestionGate";
import type { FiEventRow } from "./idempotency";
import {
  FI_EVENT_PROCESSING_LEASE_MINUTES,
  buildStaleProcessingReclaimPayloadPatch,
  isFiEventProcessingLeaseStale,
  readFiProcessingLeaseReclaimCount,
} from "./processingLeaseCore";

const TENANT = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = Date.parse("2026-07-04T12:00:00.000Z");

type TableState = Record<string, Record<string, unknown>[]>;

function baseEvent(overrides: Record<string, unknown> = {}): FiEventRow {
  return {
    id: EVENT_ID,
    tenant_id: TENANT,
    event_type: "hairaudit.images.uploaded",
    source_system: "hairaudit",
    source_event_id: "evt-1",
    occurred_at: "2026-07-04T10:00:00.000Z",
    payload_json: { images: [] },
    status: "processing",
    error_text: null,
    created_at: "2026-07-04T10:00:00.000Z",
    updated_at: "2026-07-04T10:00:00.000Z",
    ...overrides,
  } as FiEventRow;
}

function makeMockClient(state: TableState): SupabaseClient {
  const from = (table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let patch: Record<string, unknown> | null = null;

    const rows = () => (state[table] ?? []).filter((r) => filters.every((f) => f(r)));

    const applyPatch = (): Record<string, unknown> | null => {
      if (!patch) return null;
      const matchedBeforePatch = rows();
      if (matchedBeforePatch.length === 0) {
        patch = null;
        return null;
      }
      const nextRow = { ...matchedBeforePatch[0], ...patch };
      state[table] = (state[table] ?? []).map((row) =>
        row.id === matchedBeforePatch[0]?.id ? nextRow : row
      );
      patch = null;
      return nextRow;
    };

    const api = {
      select(_cols?: string) {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return api;
      },
      maybeSingle() {
        const patched = applyPatch();
        if (patched) {
          return Promise.resolve({ data: patched, error: null });
        }
        const matched = rows();
        return Promise.resolve({ data: matched[0] ?? null, error: null });
      },
      update(next: Record<string, unknown>) {
        patch = next;
        return {
          ...api,
          select: () => api,
        };
      },
    };
    return api;
  };

  return { from } as unknown as SupabaseClient;
}

test("fresh processing lease is not stale", () => {
  const updatedAt = new Date(NOW - 5 * 60_000).toISOString();
  assert.equal(isFiEventProcessingLeaseStale(updatedAt, NOW), false);
});

test("processing older than FI_EVENT_PROCESSING_LEASE_MINUTES is stale", () => {
  const updatedAt = new Date(NOW - (FI_EVENT_PROCESSING_LEASE_MINUTES + 1) * 60_000).toISOString();
  assert.equal(isFiEventProcessingLeaseStale(updatedAt, NOW), true);
});

test("fresh processing event returns already_processing", async () => {
  const freshUpdatedAt = new Date(NOW - 60_000).toISOString();
  const row = baseEvent({ updated_at: freshUpdatedAt });
  const gate = await resolveFiEventIngestionGate({ created: false, row }, { nowMs: NOW });
  assert.equal(gate.kind, "already_processing");
});

test("stale processing event is reclaimed and can proceed", async () => {
  const staleUpdatedAt = new Date(
    NOW - (FI_EVENT_PROCESSING_LEASE_MINUTES + 5) * 60_000
  ).toISOString();
  const state: TableState = {
    fi_events: [baseEvent({ updated_at: staleUpdatedAt })],
  };
  const client = makeMockClient(state);

  const gate = await resolveFiEventIngestionGate(
    { created: false, row: baseEvent({ updated_at: staleUpdatedAt }) },
    { nowMs: NOW, client }
  );

  assert.equal(gate.kind, "reclaimed_stale");
  const stored = state.fi_events?.[0];
  const lease = stored?.payload_json as { _fi_processing_lease?: Record<string, unknown> };
  assert.equal(lease?._fi_processing_lease?.reclaim_reason, "stale_processing_lease");
  assert.equal(lease?._fi_processing_lease?.previous_processing_at, staleUpdatedAt);
  assert.equal(lease?._fi_processing_lease?.reclaim_count, 1);
});

test("concurrent stale reclaim only allows one processor", async () => {
  const staleUpdatedAt = new Date(
    NOW - (FI_EVENT_PROCESSING_LEASE_MINUTES + 5) * 60_000
  ).toISOString();
  const state: TableState = {
    fi_events: [baseEvent({ updated_at: staleUpdatedAt, payload_json: { images: [] } })],
  };
  const client = makeMockClient(state);

  const [first, second] = await Promise.all([
    tryReclaimStaleFiEventProcessing({
      tenantId: TENANT,
      eventId: EVENT_ID,
      expectedUpdatedAt: staleUpdatedAt,
      existingPayload: { images: [] },
      client,
      nowMs: NOW,
    }),
    tryReclaimStaleFiEventProcessing({
      tenantId: TENANT,
      eventId: EVENT_ID,
      expectedUpdatedAt: staleUpdatedAt,
      existingPayload: { images: [] },
      client,
      nowMs: NOW,
    }),
  ]);

  const reclaimedCount = [first, second].filter((r) => r.reclaimed).length;
  assert.equal(reclaimedCount, 1);
});

test("processed event remains idempotent", async () => {
  const row = baseEvent({ status: "processed" });
  const gate = await resolveFiEventIngestionGate({ created: false, row }, { nowMs: NOW });
  assert.equal(gate.kind, "terminal_processed");
});

test("failed event remains retryable via should_process", async () => {
  const row = baseEvent({ status: "failed", error_text: "boom" });
  const gate = await resolveFiEventIngestionGate({ created: false, row }, { nowMs: NOW });
  assert.equal(gate.kind, "should_process");
});

test("reclaim count increments across repeated stale reclaims", () => {
  const first = buildStaleProcessingReclaimPayloadPatch({
    existingPayload: { images: [] },
    previousProcessingAt: "2026-07-04T08:00:00.000Z",
    reclaimedAt: "2026-07-04T12:00:00.000Z",
  });
  assert.equal(readFiProcessingLeaseReclaimCount(first), 1);

  const second = buildStaleProcessingReclaimPayloadPatch({
    existingPayload: first,
    previousProcessingAt: "2026-07-04T12:00:00.000Z",
    reclaimedAt: "2026-07-04T13:00:00.000Z",
  });
  assert.equal(readFiProcessingLeaseReclaimCount(second), 2);
});
