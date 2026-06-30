import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  processHubspotDealWebhook,
  type HubspotDealTimelineOutcome,
} from "./hubspotTimelineProcessors.server";
import { hubspotDealWebhookSchema } from "./hubspotTimelineSchemas";
import { upsertRevenuePipelineFromHubspotDeal } from "./upsertRevenuePipelineFromHubspotDeal.server";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PERSON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LEAD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PIPELINE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type QueryCtx = {
  table: string;
  filters: Record<string, string>;
  ordered: boolean;
  op: "select" | "insert" | "update";
  insertRow?: Record<string, unknown>;
  updateRow?: Record<string, unknown>;
};
type Resolved = { data: unknown; error: { code?: string; message?: string } | null };

function makeSupabase(resolve: (ctx: QueryCtx) => Resolved): SupabaseClient {
  const buildSelect = (table: string) => {
    const ctx: QueryCtx = { table, filters: {}, ordered: false, op: "select" };
    const chain: Record<string, unknown> = {
      eq: (col: string, val: unknown) => {
        ctx.filters[col] = String(val);
        return chain;
      },
      or: (expr: string) => {
        ctx.filters.__or = expr;
        return chain;
      },
      order: () => {
        ctx.ordered = true;
        return chain;
      },
      limit: () => chain,
      maybeSingle: async () => resolve(ctx),
      single: async () => resolve(ctx),
      then: (onF: (v: Resolved) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(resolve(ctx)).then(onF, onR),
    };
    return chain;
  };

  const from = (table: string) => ({
    select: () => buildSelect(table),
    insert: (row: Record<string, unknown>) => ({
      select: () => ({
        single: async () =>
          resolve({ table, filters: {}, ordered: false, op: "insert", insertRow: row }),
      }),
    }),
    update: (row: Record<string, unknown>) => {
      const ctx: QueryCtx = { table, filters: {}, ordered: false, op: "update", updateRow: row };
      const chain: Record<string, unknown> = {
        eq: (col: string, val: unknown) => {
          ctx.filters[col] = String(val);
          return chain;
        },
        select: () => ({
          single: async () => resolve(ctx),
        }),
      };
      return chain;
    },
  });

  return { from } as unknown as SupabaseClient;
}

const OK_NULL: Resolved = { data: null, error: null };

function assertDealOutcome(value: unknown): asserts value is HubspotDealTimelineOutcome {
  assert.ok(value && typeof value === "object" && "revenue_pipeline_id" in value);
}

describe("upsertRevenuePipelineFromHubspotDeal", () => {
  it("inserts a new revenue pipeline row without touching fi_crm_quotes", async () => {
    const tables: string[] = [];
    const supabase = makeSupabase((ctx) => {
      tables.push(ctx.table);
      if (ctx.table === "fi_revenue_pipeline" && ctx.op === "select") return OK_NULL;
      if (ctx.table === "fi_revenue_pipeline" && ctx.op === "insert") {
        return { data: { id: PIPELINE }, error: null };
      }
      return OK_NULL;
    });

    const r = await upsertRevenuePipelineFromHubspotDeal(supabase, {
      tenantId: TENANT,
      hubspotDealId: "DEAL-42",
      patientId: PATIENT,
      crmLeadId: LEAD,
      stageRaw: "quote_sent",
      amountRaw: 11000,
      depositAmountRaw: 2000,
      procedureType: "FUE",
      closeDateRaw: "2026-09-15",
      hubspotPayload: { hubspot_deal_id: "DEAL-42" },
    });

    assert.equal(r.id, PIPELINE);
    assert.equal(r.created, true);
    assert.equal(r.mapped_stage, "quote_sent");
    assert.ok(!tables.includes("fi_crm_quotes"));
  });

  it("updates an existing pipeline row keyed by hubspot_deal_id", async () => {
    let updatedStage: string | undefined;
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_revenue_pipeline" && ctx.op === "select") {
        return {
          data: {
            id: PIPELINE,
            stage: "quote_sent",
            expected_revenue: 10000,
            deposit_amount: null,
            balance_amount: 10000,
            probability_score: 45,
            procedure_type: null,
            forecast_date: null,
            patient_id: PATIENT,
            crm_lead_id: LEAD,
          },
          error: null,
        };
      }
      if (ctx.table === "fi_revenue_pipeline" && ctx.op === "update") {
        updatedStage = String(ctx.updateRow?.stage);
        return { data: { id: PIPELINE }, error: null };
      }
      return OK_NULL;
    });

    const r = await upsertRevenuePipelineFromHubspotDeal(supabase, {
      tenantId: TENANT,
      hubspotDealId: "DEAL-42",
      patientId: PATIENT,
      crmLeadId: LEAD,
      stageRaw: "deposit_paid",
      amountRaw: 11000,
      hubspotPayload: {},
    });

    assert.equal(r.created, false);
    assert.equal(updatedStage, "deposit_paid");
  });
});

describe("processHubspotDealWebhook", () => {
  it("upserts revenue pipeline and appends timeline for matched patient", async () => {
    let timelineTitle: string | undefined;
    let quoteWrites = 0;
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_crm_quotes") quoteWrites += 1;
      if (ctx.table === "fi_crm_lead_source_ids") return { data: { lead_id: LEAD }, error: null };
      if (ctx.table === "fi_crm_leads" && ctx.filters.id) {
        return { data: { id: LEAD, person_id: PERSON, patient_id: PATIENT }, error: null };
      }
      if (ctx.table === "fi_revenue_pipeline" && ctx.op === "select") return OK_NULL;
      if (ctx.table === "fi_revenue_pipeline" && ctx.op === "insert") {
        return { data: { id: PIPELINE }, error: null };
      }
      if (ctx.table === "fi_patient_timeline" && ctx.op === "insert") {
        timelineTitle = String(ctx.insertRow?.title);
        return { data: { id: "TL-DEAL" }, error: null };
      }
      return OK_NULL;
    });

    const payload = hubspotDealWebhookSchema.parse({
      hubspot_deal_id: "DEAL-42",
      contact_id: "HS-CONTACT",
      stage: "quote_sent",
      amount: 11000,
      procedure_type: "FUE",
      close_date: "2026-09-15",
    });

    const r = await processHubspotDealWebhook(TENANT, payload, supabase);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assertDealOutcome(r.value);
    assert.equal(r.value.matched, true);
    assert.equal(r.value.inserted, true);
    assert.equal(r.value.revenue_pipeline_id, PIPELINE);
    assert.equal(r.value.mapped_stage, "quote_sent");
    assert.match(timelineTitle ?? "", /Treatment quote updated/);
    assert.equal(quoteWrites, 0);
  });

  it("upserts revenue pipeline without timeline when patient is unmatched", async () => {
    let timelineInserts = 0;
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_revenue_pipeline" && ctx.op === "select") return OK_NULL;
      if (ctx.table === "fi_revenue_pipeline" && ctx.op === "insert") {
        return { data: { id: PIPELINE }, error: null };
      }
      if (ctx.table === "fi_patient_timeline" && ctx.op === "insert") {
        timelineInserts += 1;
        return { data: { id: "TL-X" }, error: null };
      }
      return OK_NULL;
    });

    const payload = hubspotDealWebhookSchema.parse({
      hubspot_deal_id: "DEAL-UNKNOWN",
      stage: "quote_sent",
      amount: 5000,
    });

    const r = await processHubspotDealWebhook(TENANT, payload, supabase);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assertDealOutcome(r.value);
    assert.equal(r.value.matched, false);
    assert.equal(r.value.inserted, false);
    assert.equal(r.value.revenue_pipeline_id, PIPELINE);
    assert.equal(timelineInserts, 0);
  });

  it("processes with hubspot_deal_id as the sole identity anchor", async () => {
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_crm_lead_source_ids") return OK_NULL;
      if (ctx.table === "fi_revenue_pipeline" && ctx.op === "select") return OK_NULL;
      if (ctx.table === "fi_revenue_pipeline" && ctx.op === "insert") {
        return { data: { id: PIPELINE }, error: null };
      }
      return OK_NULL;
    });

    const payload = hubspotDealWebhookSchema.parse({
      hubspot_deal_id: "DEAL-ONLY",
      stage: "quote_sent",
      amount: 5000,
    });

    const r = await processHubspotDealWebhook(TENANT, payload, supabase);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assertDealOutcome(r.value);
    assert.equal(r.value.matched, false);
    assert.equal(r.value.revenue_pipeline_id, PIPELINE);
  });
});
