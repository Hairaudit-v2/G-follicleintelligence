import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { FiExternalEventRow } from "@/src/lib/leadFlow/leadFlowFoundationTypes";
import { loadLeadFlowQueueDiagnostics } from "@/src/lib/leadFlow/leadFlowQueueDiagnostics.server";

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
    status: "failed",
    error_message: "Unable to normalize HubSpot contact payload.",
    retry_count: 3,
    last_retry_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeDiagnosticsStoreSupabase(store: Store): SupabaseClient {
  const from = (_table: string) => {
    const filters: Record<string, string | string[]> = {};
    let orderCol: string | null = null;
    let orderAsc = true;
    let limit = 25;

    const chain: Record<string, unknown> = {
      eq: (col: string, val: unknown) => {
        filters[col] = String(val);
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
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
        let rows = store.externalEvents as unknown as Record<string, unknown>[];
        rows = rows.filter((row) => {
          for (const [key, value] of Object.entries(filters)) {
            if (String(row[key] ?? "") !== String(value)) return false;
          }
          return true;
        });
        if (orderCol) {
          rows = [...rows].sort((a, b) => {
            const av = String(a[orderCol!] ?? "");
            const bv = String(b[orderCol!] ?? "");
            return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
          });
        }
        rows = rows.slice(0, limit);
        return Promise.resolve({ data: rows, error: null }).then(onF, onR);
      },
    };

    return { select: () => chain };
  };

  return { from } as unknown as SupabaseClient;
}

describe("LeadFlow queue diagnostics", () => {
  it("returns recent failed events", async () => {
    const store: Store = {
      externalEvents: [
        makeExternalEvent({ id: "evt-1", external_id: "101" }),
        makeExternalEvent({ id: "evt-2", external_id: "102", status: "processed" }),
        makeExternalEvent({ id: "evt-3", external_id: "103" }),
      ],
    };
    const supabase = makeDiagnosticsStoreSupabase(store);

    const diagnostics = await loadLeadFlowQueueDiagnostics({ tenantId: TENANT, supabase });
    assert.equal(diagnostics.tenant_id, TENANT);
    assert.equal(diagnostics.failed_events.length, 2);
    assert.ok(diagnostics.failed_events.every((e) => e.error_message));
    assert.ok(diagnostics.failed_events.some((e) => e.id === "evt-1"));
    assert.ok(diagnostics.failed_events.some((e) => e.id === "evt-3"));
  });
});
