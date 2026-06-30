import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NextRequest } from "next/server";

import type { HubSpotLeadFlowDrainResult } from "@/src/lib/leadFlow/hubspotLeadFlowQueueDrain.server";
import { handleLeadFlowHubspotEventsCronGet } from "@/src/lib/leadFlow/leadflowHubspotEventsCron.server";

const CRON_SECRET = "0123456789abcdef0123456789abcdef";
const LEADFLOW_SECRET = "fedcba9876543210fedcba9876543210";
const TENANT = "00000000-0000-4000-8000-000000000001";
const ROUTE = "https://fi.example.com/api/cron/leadflow/process-hubspot-events";

function envMap(m: Record<string, string | undefined>): (k: string) => string | undefined {
  return (k) => m[k];
}

function emptyDrainResult(
  overrides?: Partial<HubSpotLeadFlowDrainResult>
): HubSpotLeadFlowDrainResult {
  return {
    success: true,
    processed: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
    tenants: [],
    mode: "all_tenants",
    tenant_id: null,
    batch_limit: 50,
    reclaimed_stale_processing: 0,
    tenants_touched: 0,
    events: [],
    health: {
      tenant_id: null,
      provider: "hubspot",
      counts: {
        pending: 0,
        retrying: 0,
        processing: 0,
        processed: 0,
        failed: 0,
      },
      oldest_pending_at: null,
      newest_processed_at: null,
      failed_last_24h: 0,
      processed_last_24h: 0,
    },
    ...overrides,
  };
}

describe("LeadFlow HubSpot events cron", () => {
  it("rejects missing secret", async () => {
    const res = await handleLeadFlowHubspotEventsCronGet(
      new NextRequest(ROUTE, { method: "GET" }),
      {
        getEnv: envMap({ CRON_SECRET: CRON_SECRET }),
        drainQueue: async () => emptyDrainResult(),
      }
    );
    assert.equal(res.status, 401);
    const json = (await res.json()) as { ok: boolean; error?: string };
    assert.equal(json.ok, false);
    assert.equal(json.error, "Unauthorized.");
  });

  it("rejects invalid secret", async () => {
    const res = await handleLeadFlowHubspotEventsCronGet(
      new NextRequest(ROUTE, {
        method: "GET",
        headers: { authorization: "Bearer wrong-secret-value-0123456789" },
      }),
      {
        getEnv: envMap({ CRON_SECRET: CRON_SECRET }),
        drainQueue: async () => emptyDrainResult(),
      }
    );
    assert.equal(res.status, 401);
  });

  it("accepts Authorization Bearer secret", async () => {
    const res = await handleLeadFlowHubspotEventsCronGet(
      new NextRequest(ROUTE, {
        method: "GET",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
      {
        getEnv: envMap({ CRON_SECRET: CRON_SECRET }),
        drainQueue: async () => emptyDrainResult(),
      }
    );
    assert.equal(res.status, 200);
  });

  it("accepts x-fi-leadflow-secret", async () => {
    const res = await handleLeadFlowHubspotEventsCronGet(
      new NextRequest(ROUTE, {
        method: "GET",
        headers: { "x-fi-leadflow-secret": LEADFLOW_SECRET },
      }),
      {
        getEnv: envMap({ FI_LEADFLOW_CRON_SECRET: LEADFLOW_SECRET }),
        drainQueue: async () => emptyDrainResult(),
      }
    );
    assert.equal(res.status, 200);
  });

  it("passes tenantId through", async () => {
    let capturedTenantId: string | undefined;
    const res = await handleLeadFlowHubspotEventsCronGet(
      new NextRequest(`${ROUTE}?tenantId=${TENANT}`, {
        method: "GET",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
      {
        getEnv: envMap({ CRON_SECRET: CRON_SECRET }),
        drainQueue: async (opts) => {
          capturedTenantId = opts?.tenantId;
          return emptyDrainResult({ mode: "single_tenant", tenant_id: TENANT, batch_limit: 50 });
        },
      }
    );
    assert.equal(res.status, 200);
    assert.equal(capturedTenantId, TENANT);
  });

  it("caps limit at 100", async () => {
    let capturedLimit: number | undefined;
    const res = await handleLeadFlowHubspotEventsCronGet(
      new NextRequest(`${ROUTE}?limit=500`, {
        method: "GET",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
      {
        getEnv: envMap({ CRON_SECRET: CRON_SECRET }),
        drainQueue: async (opts) => {
          capturedLimit = opts?.limit;
          return emptyDrainResult({ batch_limit: 100 });
        },
      }
    );
    assert.equal(res.status, 200);
    assert.equal(capturedLimit, 100);
    const json = (await res.json()) as { source: string };
    assert.equal(json.source, "vercel_cron");
  });

  it("returns source vercel_cron", async () => {
    const res = await handleLeadFlowHubspotEventsCronGet(
      new NextRequest(ROUTE, {
        method: "GET",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
      {
        getEnv: envMap({ CRON_SECRET: CRON_SECRET }),
        drainQueue: async () => emptyDrainResult(),
      }
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      success: boolean;
      processed: number;
      failed: number;
      retried: number;
      skipped: number;
      tenants: unknown[];
      source: string;
    };
    assert.equal(json.source, "vercel_cron");
    assert.equal(json.success, true);
    assert.deepEqual(json.tenants, []);
  });
});
