import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { LEADFLOW_EVENT_META_KEY } from "@/src/lib/leadFlow/leadFlowEventMeta";
import type { FiExternalEventRow } from "@/src/lib/leadFlow/leadFlowFoundationTypes";
import { loadLeadFlowQueueHealth } from "@/src/lib/leadFlow/leadFlowQueueHealth.server";

const TENANT = "11111111-1111-4111-8111-111111111111";

type Store = {
  externalEvents: FiExternalEventRow[];
};

function makeExternalEvent(overrides: Partial<FiExternalEventRow> = {}): FiExternalEventRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT,
    provider: "hubspot",
    event_type: "hubspot.contact.updated",
    external_id: "501",
    provider_event_id: `evt-${randomUUID()}`,
    payload_json: {},
    status: "pending",
    error_message: null,
    retry_count: 0,
    last_retry_at: null,
    processed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function matchesHealthFilters(row: Record<string, unknown>, filters: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (key === "__in") {
      const inFilters = value as Record<string, string[]>;
      for (const [col, allowed] of Object.entries(inFilters)) {
        if (!allowed.includes(String(row[col] ?? ""))) return false;
      }
      continue;
    }
    if (String(row[key] ?? "") !== String(value)) return false;
  }
  return true;
}

function makeHealthStoreSupabase(store: Store): SupabaseClient {
  const from = (_table: string) => {
    const buildSelect = (opts?: { count?: string; head?: boolean }) => {
      const filters: Record<string, unknown> = {};
      let gteCol: { col: string; val: string } | null = null;
      let notNullCol: string | null = null;
      let orderCol: string | null = null;
      let orderAsc = true;
      let limit = 100;

      const chain: Record<string, unknown> = {
        eq: (col: string, val: unknown) => {
          filters[col] = String(val);
          return chain;
        },
        in: (col: string, vals: unknown[]) => {
          const existing = (filters.__in as Record<string, string[]> | undefined) ?? {};
          filters.__in = { ...existing, [col]: vals.map(String) };
          return chain;
        },
        gte: (col: string, val: unknown) => {
          gteCol = { col, val: String(val) };
          return chain;
        },
        not: (col: string, _op: string, _val: unknown) => {
          notNullCol = col;
          return chain;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          orderCol = col;
          orderAsc = opts?.ascending !== false;
          return chain;
        },
        limit: (n: number) => {
          limit = n;
          return chain;
        },
        maybeSingle: async () => {
          let rows = (store.externalEvents as unknown as Record<string, unknown>[]).filter((row) =>
            matchesHealthFilters(row, filters)
          );
          if (gteCol) {
            rows = rows.filter((row) => String(row[gteCol!.col] ?? "") >= gteCol!.val);
          }
          if (notNullCol) {
            rows = rows.filter((row) => row[notNullCol!] != null);
          }
          if (orderCol) {
            rows.sort((a, b) => {
              const av = String(a[orderCol!] ?? "");
              const bv = String(b[orderCol!] ?? "");
              return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
            });
          }
          rows = rows.slice(0, limit);
          return { data: rows[0] ?? null, error: null, count: rows.length };
        },
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
          let rows = (store.externalEvents as unknown as Record<string, unknown>[]).filter((row) =>
            matchesHealthFilters(row, filters)
          );
          if (gteCol) {
            rows = rows.filter((row) => String(row[gteCol!.col] ?? "") >= gteCol!.val);
          }
          if (notNullCol) {
            rows = rows.filter((row) => row[notNullCol!] != null);
          }
          if (orderCol) {
            rows.sort((a, b) => {
              const av = String(a[orderCol!] ?? "");
              const bv = String(b[orderCol!] ?? "");
              return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
            });
          }
          rows = rows.slice(0, limit);
          if (opts?.head && opts?.count === "exact") {
            return Promise.resolve({ data: null, error: null, count: rows.length }).then(onF, onR);
          }
          return Promise.resolve({ data: rows, error: null, count: rows.length }).then(onF, onR);
        },
      };
      return chain;
    };

    return {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => buildSelect(opts),
    };
  };

  return { from } as unknown as SupabaseClient;
}

describe("LeadFlow queue health", () => {
  it("returns correct counts and timestamps", async () => {
    const now = Date.now();
    const store: Store = {
      externalEvents: [
        makeExternalEvent({
          status: "pending",
          created_at: new Date(now - 60_000).toISOString(),
        }),
        makeExternalEvent({ status: "retrying" }),
        makeExternalEvent({ status: "processing" }),
        makeExternalEvent({
          status: "processed",
          processed_at: new Date(now - 30_000).toISOString(),
        }),
        makeExternalEvent({
          status: "processed",
          processed_at: new Date(now - 30 * 60 * 1000).toISOString(),
        }),
        makeExternalEvent({
          status: "failed",
          processed_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        }),
        makeExternalEvent({
          status: "failed",
          processed_at: new Date(now - 30 * 60 * 1000).toISOString(),
        }),
      ],
    };
    const supabase = makeHealthStoreSupabase(store);

    const health = await loadLeadFlowQueueHealth({ tenantId: TENANT, supabase });
    assert.equal(health.counts.pending, 1);
    assert.equal(health.counts.retrying, 1);
    assert.equal(health.counts.processing, 1);
    assert.equal(health.counts.processed, 2);
    assert.equal(health.counts.failed, 2);
    assert.equal(health.failed_last_24h, 2);
    assert.equal(health.processed_last_24h, 2);
    assert.ok(health.oldest_pending_at);
    assert.ok(health.newest_processed_at);
  });
});

describe("LeadFlow event meta", () => {
  it("stores failure metadata under payload_json._leadflow", () => {
    const payload = { eventId: "evt-1" };
    const merged = {
      ...payload,
      [LEADFLOW_EVENT_META_KEY]: {
        processing_error: "Unable to normalize HubSpot contact payload.",
        failed_at: new Date().toISOString(),
        failed_from_status: "processing",
      },
    };
    assert.equal(typeof merged._leadflow, "object");
    assert.ok(String((merged._leadflow as { processing_error?: string }).processing_error).length > 0);
  });
});
