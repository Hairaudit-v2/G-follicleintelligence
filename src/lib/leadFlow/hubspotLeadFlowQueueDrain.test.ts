import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  drainHubSpotLeadFlowQueue,
  summarizeLeadFlowDrainResults,
} from "@/src/lib/leadFlow/hubspotLeadFlowQueueDrain.server";
import type { FiExternalEventRow, FiLeadActivityRow, FiLeadRow } from "@/src/lib/leadFlow/leadFlowFoundationTypes";

const TENANT = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

type Store = {
  externalEvents: FiExternalEventRow[];
  leads: FiLeadRow[];
  activity: FiLeadActivityRow[];
};

function makeExternalEvent(payload: Record<string, unknown>, overrides: Partial<FiExternalEventRow> = {}): FiExternalEventRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT,
    provider: "hubspot",
    event_type: "hubspot.contact.updated",
    external_id: "501",
    provider_event_id: `evt-${randomUUID()}`,
    payload_json: payload,
    status: "pending",
    error_message: null,
    retry_count: 0,
    last_retry_at: null,
    processed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function matchesFilters(row: Record<string, unknown>, filters: Record<string, string | string[]>): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (key.startsWith("__in:")) continue;
    if (Array.isArray(value)) {
      if (!value.includes(String(row[key] ?? ""))) return false;
    } else if (String(row[key] ?? "") !== value) {
      return false;
    }
  }
  for (const [key, allowed] of Object.entries(filters)) {
    if (!key.startsWith("__in:")) continue;
    const col = key.slice(5);
    const vals = allowed as string[];
    if (!vals.includes(String(row[col] ?? ""))) return false;
  }
  return true;
}

function makeDrainStoreSupabase(store: Store): SupabaseClient {
  const buildSelect = (table: string, opts?: { count?: string; head?: boolean }) => {
    const filters: Record<string, string | string[]> = {};
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
        filters[`__in:${col}`] = vals.map(String);
        return chain;
      },
      gte: (col: string, val: unknown) => {
        gteCol = { col, val: String(val) };
        return chain;
      },
      not: (col: string) => {
        notNullCol = col;
        return chain;
      },
      order: (col: string, orderOpts?: { ascending?: boolean }) => {
        orderCol = col;
        orderAsc = orderOpts?.ascending !== false;
        return chain;
      },
      limit: (n: number) => {
        limit = n;
        return chain;
      },
      maybeSingle: async () => {
        const rows = getRows(table, filters, gteCol, notNullCol, orderCol, orderAsc, limit);
        return { data: rows[0] ?? null, error: null, count: rows.length };
      },
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
        const rows = getRows(table, filters, gteCol, notNullCol, orderCol, orderAsc, limit);
        if (opts?.head && opts?.count === "exact") {
          return Promise.resolve({ data: null, error: null, count: rows.length }).then(onF, onR);
        }
        return Promise.resolve({ data: rows, error: null, count: rows.length }).then(onF, onR);
      },
    };
    return chain;
  };

  function getRows(
    table: string,
    filters: Record<string, string | string[]>,
    gteCol: { col: string; val: string } | null,
    notNullCol: string | null,
    orderCol: string | null,
    orderAsc: boolean,
    limit: number
  ): Record<string, unknown>[] {
    let rows = getTable(table) as Record<string, unknown>[];
    rows = rows.filter((row) => matchesFilters(row, filters));
    if (gteCol) rows = rows.filter((row) => String(row[gteCol!.col] ?? "") >= gteCol!.val);
    if (notNullCol) rows = rows.filter((row) => row[notNullCol!] != null);
    if (orderCol) {
      rows = [...rows].sort((a, b) => {
        const av = String(a[orderCol!] ?? "");
        const bv = String(b[orderCol!] ?? "");
        return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows.slice(0, limit);
  }

  function getTable(table: string): unknown[] {
    if (table === "fi_external_events") return store.externalEvents;
    if (table === "fi_leads") return store.leads;
    if (table === "fi_lead_activity") return store.activity;
    return [];
  }

  const from = (table: string) => ({
    select: (_cols?: string, opts?: { count?: string; head?: boolean }) => buildSelect(table, opts),
    insert: (row: Record<string, unknown>) => {
      const insertedRow = { id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row };
      if (table === "fi_leads") store.leads.push(insertedRow as FiLeadRow);
      if (table === "fi_lead_activity") store.activity.push(insertedRow as unknown as FiLeadActivityRow);
      const result = { data: insertedRow, error: null };
      return {
        select: () => ({ maybeSingle: async () => result, single: async () => result }),
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => Promise.resolve(result).then(onF, onR),
      };
    },
    update: (patch: Record<string, unknown>) => {
      const filters: Record<string, string | string[]> = {};
      const chain: Record<string, unknown> = {
        eq: (col: string, val: unknown) => {
          filters[col] = String(val);
          return chain;
        },
        in: (col: string, vals: unknown[]) => {
          filters[`__in:${col}`] = vals.map(String);
          return chain;
        },
        select: () => ({
          maybeSingle: async () => {
            const tableRows = getTable(table) as Array<Record<string, unknown>>;
            const row = tableRows.find((r) => matchesFilters(r, filters));
            if (!row) return { data: null, error: null };
            Object.assign(row, patch);
            return { data: row, error: null };
          },
        }),
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
          for (const row of getTable(table) as Array<Record<string, unknown>>) {
            if (matchesFilters(row, filters)) Object.assign(row, patch);
          }
          return Promise.resolve({ data: null, error: null }).then(onF, onR);
        },
      };
      return chain;
    },
  });

  return { from } as unknown as SupabaseClient;
}

describe("LeadFlow LF-2B HubSpot queue drain", () => {
  it("drains pending events for a tenant and returns API-shaped summary", async () => {
    const store: Store = {
      externalEvents: [
        makeExternalEvent({
          hubspot_contact_id: "900",
          properties: { email: "drain@example.com", firstname: "Drain" },
        }),
      ],
      leads: [],
      activity: [],
    };
    const supabase = makeDrainStoreSupabase(store);
    const result = await drainHubSpotLeadFlowQueue({ tenantId: TENANT, limit: 50, supabase });

    assert.equal(result.success, true);
    assert.equal(result.processed, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.retried, 0);
    assert.equal(result.skipped, 0);
    assert.equal(result.tenants.length, 1);
    assert.equal(result.tenants[0]?.tenant_id, TENANT);
    assert.equal(store.leads.length, 1);
    assert.equal(result.health.counts.pending, 0);
    assert.equal(result.health.counts.processed, 1);
  });

  it("tenantId only processes that tenant", async () => {
    const store: Store = {
      externalEvents: [
        makeExternalEvent(
          { hubspot_contact_id: "1", properties: { email: "a@example.com" } },
          { tenant_id: TENANT }
        ),
        makeExternalEvent(
          { hubspot_contact_id: "2", properties: { email: "b@example.com" } },
          { tenant_id: TENANT_B }
        ),
      ],
      leads: [],
      activity: [],
    };
    const supabase = makeDrainStoreSupabase(store);
    const result = await drainHubSpotLeadFlowQueue({ tenantId: TENANT, supabase });

    assert.equal(result.processed, 1);
    assert.equal(store.leads.length, 1);
    assert.equal(store.externalEvents.find((e) => e.tenant_id === TENANT_B)?.status, "pending");
  });

  it("all-tenant mode processes multiple tenants safely", async () => {
    const store: Store = {
      externalEvents: [
        makeExternalEvent(
          { hubspot_contact_id: "1", properties: { email: "a@example.com" } },
          { tenant_id: TENANT }
        ),
        makeExternalEvent(
          { hubspot_contact_id: "2", properties: { email: "b@example.com" } },
          { tenant_id: TENANT_B }
        ),
      ],
      leads: [],
      activity: [],
    };
    const supabase = makeDrainStoreSupabase(store);
    const result = await drainHubSpotLeadFlowQueue({ limit: 50, supabase });

    assert.equal(result.mode, "all_tenants");
    assert.equal(result.processed, 2);
    assert.equal(result.tenants.length, 2);
    assert.equal(store.leads.length, 2);
  });

  it("summarizeLeadFlowDrainResults aggregates outcomes", () => {
    const summary = summarizeLeadFlowDrainResults([
      { eventId: "1", tenantId: TENANT, outcome: "processed" },
      { eventId: "2", tenantId: TENANT, outcome: "retried", message: "bad payload" },
      { eventId: "3", tenantId: TENANT_B, outcome: "failed", message: "terminal" },
      { eventId: "4", tenantId: TENANT_B, outcome: "skipped" },
    ]);

    assert.equal(summary.processed, 1);
    assert.equal(summary.retried, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.skipped, 1);
    assert.equal(summary.tenants.length, 2);
  });
});
