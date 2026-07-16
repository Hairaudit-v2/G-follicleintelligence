import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadHubspotBackupHealthSummary } from "./hubspotBackupHealth.server";

type Row = Record<string, unknown>;

/**
 * Minimal thenable query builder that records eq filters so latest vs active
 * run queries can be distinguished under Promise.all.
 */
function makeQuery(resolve: (filters: Record<string, string>) => { data: unknown; error: unknown }) {
  const filters: Record<string, string> = {};
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = () => self();
  api.eq = (col: string, val: string) => {
    filters[col] = String(val);
    return self();
  };
  api.neq = (col: string, val: string) => {
    filters[`neq:${col}`] = String(val);
    return self();
  };
  api.in = () => self();
  api.order = () => self();
  api.limit = () => self();
  api.maybeSingle = async () => resolve(filters);
  (api as { then: unknown }).then = (
    onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(resolve(filters)).then(onFulfilled, onRejected);
  return api;
}

function makeSupabase(state: {
  watermark?: Row | null;
  latest?: Row | null;
  active?: Row | null;
  alerts?: Row[];
  forceError?: boolean;
}) {
  return {
    from(table: string) {
      if (state.forceError) {
        return makeQuery(() => ({ data: null, error: { message: "boom" } }));
      }
      if (table === "fi_external_hubspot_backup_watermarks") {
        return makeQuery(() => ({ data: state.watermark ?? null, error: null }));
      }
      if (table === "fi_external_hubspot_sync_runs") {
        return makeQuery((filters) => {
          if (filters.status === "started") {
            return { data: state.active ?? null, error: null };
          }
          return { data: state.latest ?? null, error: null };
        });
      }
      if (table === "fi_admin_notifications") {
        return makeQuery(() => ({ data: state.alerts ?? [], error: null }));
      }
      return makeQuery(() => ({ data: null, error: null }));
    },
  };
}

const TENANT = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const INTEGRATION = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";

const emptySuccessLatest = {
  id: "3b0a231b-9a0c-4ab4-a6d9-81bca8b2c3b4",
  status: "completed",
  started_at: "2026-07-16T03:45:02.366Z",
  completed_at: "2026-07-16T03:45:10.000Z",
  incremental_verification_state: "passed",
  incremental_cutoff_from: "2026-07-16T03:20:00.000Z",
  incremental_cutoff_to: "2026-07-16T03:45:02.366Z",
  detail: { empty_range: true, counters: { discovered: 0, inserted: 0, failed: 0 } },
  engagement_counters: null,
  incremental_checkpoint: {},
};

describe("loadHubspotBackupHealthSummary", () => {
  it("returns Healthy for empty_success verified run with matching watermark", async () => {
    const summary = await loadHubspotBackupHealthSummary(TENANT, INTEGRATION, {
      supabaseClientForTests: makeSupabase({
        watermark: { watermark_timestamp: "2026-07-16T03:45:02.366Z" },
        latest: emptySuccessLatest,
        active: null,
        alerts: [],
      }) as never,
      getEnv: (key) =>
        key === "FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED" ? "true" : undefined,
      nowMs: Date.parse("2026-07-16T10:00:00.000Z"),
      includeTechnicalDetail: true,
    });
    assert.equal(summary.status, "healthy");
    assert.equal(summary.latestRun?.outcome, "empty_success");
    assert.equal(summary.evidenceSeparationPreserved, true);
    assert.ok(summary.primaryEvidence.label.includes("Primary"));
    assert.ok(summary.secondaryEvidence.label.includes("Secondary"));
  });

  it("redacts technical detail for low-role", async () => {
    const summary = await loadHubspotBackupHealthSummary(TENANT, INTEGRATION, {
      supabaseClientForTests: makeSupabase({
        watermark: { watermark_timestamp: "2026-07-16T03:45:02.366Z" },
        latest: emptySuccessLatest,
        alerts: [],
      }) as never,
      getEnv: (key) =>
        key === "FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED" ? "true" : undefined,
      nowMs: Date.parse("2026-07-16T10:00:00.000Z"),
      includeTechnicalDetail: false,
    });
    assert.equal(summary.status, "healthy");
    assert.equal(summary.watermark.value, null);
    assert.equal(summary.latestRun?.runId, "");
  });

  it("fails closed without tenant context", async () => {
    const summary = await loadHubspotBackupHealthSummary("", INTEGRATION, {
      nowMs: Date.parse("2026-07-16T10:00:00.000Z"),
    });
    assert.notEqual(summary.status, "healthy");
    assert.equal(summary.reasonCode, "tenant_missing");
  });

  it("query error never yields Healthy", async () => {
    const summary = await loadHubspotBackupHealthSummary(TENANT, INTEGRATION, {
      supabaseClientForTests: makeSupabase({ forceError: true }) as never,
      getEnv: () => "true",
      nowMs: Date.parse("2026-07-16T10:00:00.000Z"),
    });
    assert.notEqual(summary.status, "healthy");
  });
});
