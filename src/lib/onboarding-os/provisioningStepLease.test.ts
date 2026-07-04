import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveProvisioningStepRunGate,
  tryReclaimStaleProvisioningStep,
  type ProvisioningStepLeaseRow,
} from "./provisioningStepGate";
import {
  TENANT_PROVISIONING_STEP_LEASE_MINUTES,
  buildStaleProvisioningStepReclaimMetadataPatch,
  isProvisioningStepLeaseStale,
  readProvisioningStepLeaseReclaimCount,
} from "./provisioningStepLeaseCore";

const STEP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = Date.parse("2026-07-04T12:00:00.000Z");

type TableState = Record<string, Record<string, unknown>[]>;

function baseStep(overrides: Partial<ProvisioningStepLeaseRow> = {}): ProvisioningStepLeaseRow {
  return {
    id: STEP_ID,
    session_id: SESSION_ID,
    step_code: "validate_input",
    status: "running",
    attempt_count: 1,
    max_attempts: 3,
    started_at: "2026-07-04T10:00:00.000Z",
    error_code: null,
    error_message: null,
    metadata: {},
    updated_at: "2026-07-04T10:00:00.000Z",
    ...overrides,
  };
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

test("fresh running lease is not stale", () => {
  const updatedAt = new Date(NOW - 5 * 60_000).toISOString();
  assert.equal(isProvisioningStepLeaseStale(updatedAt, NOW), false);
});

test("running older than TENANT_PROVISIONING_STEP_LEASE_MINUTES is stale", () => {
  const updatedAt = new Date(
    NOW - (TENANT_PROVISIONING_STEP_LEASE_MINUTES + 1) * 60_000
  ).toISOString();
  assert.equal(isProvisioningStepLeaseStale(updatedAt, NOW), true);
});

test("fresh running step returns already_running", async () => {
  const freshUpdatedAt = new Date(NOW - 60_000).toISOString();
  const gate = await resolveProvisioningStepRunGate(baseStep({ updated_at: freshUpdatedAt }), {
    nowMs: NOW,
  });
  assert.equal(gate.kind, "already_running");
});

test("stale running step is reclaimed and can proceed", async () => {
  const staleUpdatedAt = new Date(
    NOW - (TENANT_PROVISIONING_STEP_LEASE_MINUTES + 5) * 60_000
  ).toISOString();
  const state: TableState = {
    fi_tenant_provisioning_steps: [
      {
        id: STEP_ID,
        session_id: SESSION_ID,
        step_code: "validate_input",
        status: "running",
        attempt_count: 1,
        max_attempts: 3,
        started_at: "2026-07-04T10:00:00.000Z",
        error_code: null,
        error_message: null,
        metadata: {},
        updated_at: staleUpdatedAt,
      },
    ],
  };
  const client = makeMockClient(state);

  const gate = await resolveProvisioningStepRunGate(baseStep({ updated_at: staleUpdatedAt }), {
    nowMs: NOW,
    client,
  });

  assert.equal(gate.kind, "reclaimed_stale");
  const stored = state.fi_tenant_provisioning_steps?.[0];
  const lease = stored?.metadata as { _provisioning_step_lease?: Record<string, unknown> };
  assert.equal(lease?._provisioning_step_lease?.reclaim_reason, "stale_running_lease");
  assert.equal(lease?._provisioning_step_lease?.previous_running_at, staleUpdatedAt);
  assert.equal(lease?._provisioning_step_lease?.reclaim_count, 1);
  assert.equal(lease?._provisioning_step_lease?.attempt_count_at_reclaim, 2);
  assert.equal(stored?.attempt_count, 2);
});

test("concurrent stale reclaim only allows one processor", async () => {
  const staleUpdatedAt = new Date(
    NOW - (TENANT_PROVISIONING_STEP_LEASE_MINUTES + 5) * 60_000
  ).toISOString();
  const state: TableState = {
    fi_tenant_provisioning_steps: [
      {
        id: STEP_ID,
        session_id: SESSION_ID,
        step_code: "validate_input",
        status: "running",
        attempt_count: 1,
        max_attempts: 3,
        started_at: "2026-07-04T10:00:00.000Z",
        error_code: null,
        error_message: null,
        metadata: {},
        updated_at: staleUpdatedAt,
      },
    ],
  };
  const client = makeMockClient(state);

  const [first, second] = await Promise.all([
    tryReclaimStaleProvisioningStep({
      stepId: STEP_ID,
      expectedUpdatedAt: staleUpdatedAt,
      existingMetadata: {},
      attemptCount: 1,
      client,
      nowMs: NOW,
    }),
    tryReclaimStaleProvisioningStep({
      stepId: STEP_ID,
      expectedUpdatedAt: staleUpdatedAt,
      existingMetadata: {},
      attemptCount: 1,
      client,
      nowMs: NOW,
    }),
  ]);

  const reclaimedCount = [first, second].filter((r) => r.reclaimed).length;
  assert.equal(reclaimedCount, 1);
});

test("completed step remains idempotent", async () => {
  const gate = await resolveProvisioningStepRunGate(
    baseStep({ status: "completed", updated_at: "2026-07-04T10:00:00.000Z" }),
    { nowMs: NOW }
  );
  assert.equal(gate.kind, "already_completed");
});

test("pending step can proceed via should_run", async () => {
  const gate = await resolveProvisioningStepRunGate(
    baseStep({ status: "pending", updated_at: "2026-07-04T10:00:00.000Z" }),
    { nowMs: NOW }
  );
  assert.equal(gate.kind, "should_run");
});

test("reclaim count increments across repeated stale reclaims", () => {
  const first = buildStaleProvisioningStepReclaimMetadataPatch({
    existingMetadata: {},
    previousRunningAt: "2026-07-04T08:00:00.000Z",
    reclaimedAt: "2026-07-04T12:00:00.000Z",
    attemptCountAtReclaim: 2,
  });
  assert.equal(readProvisioningStepLeaseReclaimCount(first), 1);

  const second = buildStaleProvisioningStepReclaimMetadataPatch({
    existingMetadata: first,
    previousRunningAt: "2026-07-04T12:00:00.000Z",
    reclaimedAt: "2026-07-04T13:00:00.000Z",
    attemptCountAtReclaim: 3,
  });
  assert.equal(readProvisioningStepLeaseReclaimCount(second), 2);
});