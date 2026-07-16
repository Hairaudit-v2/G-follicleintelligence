import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HubspotReadError,
  hubspotReadJson,
  stageHubspotContactRefreshBatch,
} from "./hubspotBackupEngine.server";

describe("HubSpot resumable backup transport", () => {
  it("uses GET bearer auth and returns only parsed JSON", async () => {
    let seenMethod = "";
    let seenAuth = "";
    const fakeFetch: typeof fetch = async (_input, init) => {
      seenMethod = String(init?.method);
      seenAuth = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ results: [{ id: "1" }] }), { status: 200 });
    };
    const result = await hubspotReadJson<{ results: { id: string }[] }>(
      "/crm/v3/objects/contacts",
      "not-a-real-token",
      { limit: "1" },
      fakeFetch
    );
    assert.equal(seenMethod, "GET");
    assert.equal(seenAuth, "Bearer not-a-real-token");
    assert.equal(result.results.length, 1);
  });

  it("honours Retry-After with bounded retries", async () => {
    let calls = 0;
    const fakeFetch: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) return new Response("sensitive provider body", { status: 429, headers: { "retry-after": "0" } });
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };
    await hubspotReadJson("/crm/v3/objects/deals", "token", {}, fakeFetch);
    assert.equal(calls, 2);
  });

  it("does not retain provider response bodies in errors", async () => {
    const fakeFetch: typeof fetch = async () => new Response("customer data must not escape", { status: 403 });
    await assert.rejects(
      () => hubspotReadJson("/crm/v3/pipelines/deals", "token", {}, fakeFetch),
      (error: unknown) =>
        error instanceof HubspotReadError &&
        error.category === "permission" &&
        !error.message.includes("customer data")
    );
  });

  it("surfaces a missing live contact once and remains idempotent on retry", async () => {
    const staged = new Map<string, Record<string, unknown>>();
    const supabase = {
      from(table: string) {
        const chain = {
          select() {
            return chain;
          },
          eq() {
            return chain;
          },
          in(_column: string, ids: string[]) {
            return Promise.resolve({
              data: table === "fi_external_hubspot_contact_staging"
                ? ids
                    .filter((id) => staged.has(id))
                    .map((hubspot_contact_id) => ({ hubspot_contact_id }))
                : [],
              error: null,
            });
          },
          upsert(rows: Record<string, unknown>[]) {
            if (table === "fi_external_hubspot_contact_staging") {
              for (const row of rows) staged.set(String(row.hubspot_contact_id), row);
            }
            return Promise.resolve({ error: null });
          },
        };
        return chain;
      },
    } as unknown as SupabaseClient;
    const params = {
      supabase,
      contacts: [
        {
          id: "229761370222",
          createdAt: "2026-07-16T04:15:52.321Z",
          updatedAt: "2026-07-16T11:33:03.155Z",
          properties: { email: "refresh@example.org" },
        },
      ],
      tenantId: "tenant-1",
      integrationId: "integration-1",
      syncRunId: "run-1",
    };
    const first = await stageHubspotContactRefreshBatch(params);
    const second = await stageHubspotContactRefreshBatch({ ...params, syncRunId: "run-2" });
    assert.equal(first.duplicates, 0);
    assert.equal(second.duplicates, 1);
    assert.equal(staged.size, 1);
    assert.equal(staged.get("229761370222")?.sync_run_id, "run-2");
  });
});
