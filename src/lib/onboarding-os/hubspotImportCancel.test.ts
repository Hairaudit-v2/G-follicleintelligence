import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cancelHubspotImport } from "@/src/lib/onboarding-os/hubspotImport.server";
import { isHubspotImportStatus } from "@/src/lib/onboarding-os/hubspotConnectorTypes";

const TENANT = "11111111-1111-4111-8111-111111111111";
const INTEGRATION = "22222222-2222-4222-8222-222222222222";
const STAGING = "33333333-3333-4333-8333-333333333333";

function buildCancelMock(opts: {
  table: "fi_external_hubspot_contact_staging" | "fi_external_hubspot_deal_staging";
  importStatus: string;
  updates: Array<{ table: string; payload: Record<string, unknown>; filters: Record<string, string> }>;
  audits: Array<{ table: string; payload: Record<string, unknown> }>;
}) {
  return {
    from(table: string) {
      const filters: Record<string, string> = {};
      let updatePayload: Record<string, unknown> | null = null;

      const chain: {
        select: () => typeof chain;
        eq: (col: string, val: string) => typeof chain;
        update: (payload: Record<string, unknown>) => typeof chain;
        maybeSingle: () => Promise<{ data: unknown; error: null }>;
        insert: (payload: Record<string, unknown>) => Promise<{ error: null }>;
        then: (
          resolve: (v: { data: null; error: null }) => void,
          reject?: (e: unknown) => void
        ) => void;
      } = {
        select: () => chain,
        eq(col: string, val: string) {
          filters[col] = val;
          return chain;
        },
        update(payload: Record<string, unknown>) {
          updatePayload = payload;
          return chain;
        },
        async maybeSingle() {
          if (table === opts.table) {
            return {
              data: {
                id: STAGING,
                import_status: opts.importStatus,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        async insert(payload: Record<string, unknown>) {
          opts.audits.push({ table, payload });
          return { error: null };
        },
        then(resolve) {
          if (updatePayload) {
            opts.updates.push({ table, payload: updatePayload, filters: { ...filters } });
          }
          resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  };
}

describe("isHubspotImportStatus", () => {
  it("allows rejected status used by cancelHubspotImport", () => {
    assert.equal(isHubspotImportStatus("rejected"), true);
    assert.equal(isHubspotImportStatus("approved"), true);
    assert.equal(isHubspotImportStatus("cancelled"), false);
  });
});

describe("cancelHubspotImport", () => {
  it("sets approved contact staging to rejected and writes audit events", async () => {
    const updates: Array<{
      table: string;
      payload: Record<string, unknown>;
      filters: Record<string, string>;
    }> = [];
    const audits: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const supabase = buildCancelMock({
      table: "fi_external_hubspot_contact_staging",
      importStatus: "approved",
      updates,
      audits,
    });

    const result = await cancelHubspotImport("contact", STAGING, INTEGRATION, TENANT, {
      supabaseClientForTests: supabase as never,
      skipAuthCheck: true,
      actorAuthUserId: "auth-user",
    });

    assert.equal(result.ok, true);
    assert.equal(updates.length, 1);
    assert.equal(updates[0]!.table, "fi_external_hubspot_contact_staging");
    assert.equal(updates[0]!.payload.import_status, "rejected");
    assert.equal(updates[0]!.filters.id, STAGING);
    assert.equal(updates[0]!.filters.integration_id, INTEGRATION);
    assert.equal(updates[0]!.filters.tenant_id, TENANT);

    assert.ok(
      audits.some(
        (a) =>
          a.table === "fi_external_import_events" && a.payload.event_kind === "import_cancelled"
      )
    );
    assert.ok(
      audits.some(
        (a) =>
          a.table === "fi_external_hubspot_import_audit" &&
          a.payload.action === "contact_import_cancelled"
      )
    );
  });

  it("sets approved deal staging to rejected", async () => {
    const updates: Array<{
      table: string;
      payload: Record<string, unknown>;
      filters: Record<string, string>;
    }> = [];
    const audits: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const supabase = buildCancelMock({
      table: "fi_external_hubspot_deal_staging",
      importStatus: "approved",
      updates,
      audits,
    });

    const result = await cancelHubspotImport("deal", STAGING, INTEGRATION, TENANT, {
      supabaseClientForTests: supabase as never,
      skipAuthCheck: true,
      actorAuthUserId: "auth-user",
    });

    assert.equal(result.ok, true);
    assert.equal(updates[0]!.table, "fi_external_hubspot_deal_staging");
    assert.equal(updates[0]!.payload.import_status, "rejected");
    assert.ok(
      audits.some(
        (a) =>
          a.table === "fi_external_hubspot_import_audit" &&
          a.payload.action === "deal_import_cancelled"
      )
    );
  });

  it("is idempotent when already rejected (no second status update)", async () => {
    const updates: Array<{
      table: string;
      payload: Record<string, unknown>;
      filters: Record<string, string>;
    }> = [];
    const audits: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const supabase = buildCancelMock({
      table: "fi_external_hubspot_contact_staging",
      importStatus: "rejected",
      updates,
      audits,
    });

    const result = await cancelHubspotImport("contact", STAGING, INTEGRATION, TENANT, {
      supabaseClientForTests: supabase as never,
      skipAuthCheck: true,
      actorAuthUserId: "auth-user",
    });

    assert.equal(result.ok, true);
    assert.equal(updates.length, 0);
    assert.ok(audits.some((a) => a.payload.event_kind === "import_cancelled"));
  });

  it("refuses cancel after import", async () => {
    const updates: Array<{
      table: string;
      payload: Record<string, unknown>;
      filters: Record<string, string>;
    }> = [];
    const audits: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const supabase = buildCancelMock({
      table: "fi_external_hubspot_contact_staging",
      importStatus: "imported",
      updates,
      audits,
    });

    const result = await cancelHubspotImport("contact", STAGING, INTEGRATION, TENANT, {
      supabaseClientForTests: supabase as never,
      skipAuthCheck: true,
      actorAuthUserId: "auth-user",
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /already imported/i);
    assert.equal(updates.length, 0);
    assert.equal(audits.length, 0);
  });
});
