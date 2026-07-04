import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadSurgeryIntelligenceDashboard } from "./surgeryIntelligenceDashboardLoader.server";
import { SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE } from "./surgeryCaseFactsPublisherCore";
import { SURGERY_CASE_INTELLIGENCE_FACTS_VERSION } from "./surgeryCaseFactsCore";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const CASE = "33333333-3333-4333-8333-333333333333";
const SURGERY = "44444444-4444-4444-8444-444444444444";

type StoredRow = Record<string, unknown>;

function makeEventRow(input: {
  tenantId: string;
  occurredAt: string;
  hasFinal: boolean;
  graftCount: number | null;
}): StoredRow {
  return {
    id: randomUUID(),
    tenant_id: input.tenantId,
    clinic_id: null,
    module_name: "surgery_os",
    event_type: SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE,
    entity_id: CASE,
    entity_type: "case",
    event_value: input.graftCount,
    event_metadata: {
      source: "surgery_case_intelligence",
      facts_version: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
      last_published_at: input.occurredAt,
      payload_json: {
        facts_version: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
        tenant_id: input.tenantId,
        patient_id: null,
        case_id: CASE,
        surgery_id: SURGERY,
        booking_id: null,
        procedure_date: "2026-07-04",
        final_reviewed_graft_count: input.hasFinal ? input.graftCount : null,
        graft_tray_ai_estimate: 120,
        graft_tray_manual_count: 118,
        graft_count_source: input.hasFinal ? "ai" : null,
        mismatch_band: "within_tolerance",
        confidence_band: "high",
        image_quality: "suitable",
        reviewer_id: null,
        reviewer_label: null,
        reviewed_at: null,
        has_final_graft_count: input.hasFinal,
        graft_tray_review_pending: !input.hasFinal,
        superseded_stale_estimate: false,
        graft_session_id: null,
        target_grafts: 3000,
        extracted_grafts: 1200,
        implanted_grafts: 0,
        discarded_grafts: 0,
        remaining_grafts: 1200,
        reconciliation_status: "pending",
        graft_session_phase: "extraction",
        reconciled_at: null,
        confirmed_tray_grafts: 0,
        surgery_status: null,
        procedure_phase: null,
        live_status: null,
        surgeon_fi_user_id: null,
        team_fi_user_ids: [],
        graft_tray_image_ids: [],
        graft_tray_link_ids: [],
        graft_tray_links: [],
        graft_tray_outcome_facts: [],
        confidence_level: "high",
      },
    },
    occurred_at: input.occurredAt,
    created_at: input.occurredAt,
  };
}

function createAnalyticsEventsMock(store: StoredRow[]) {
  const api = {
    select(_cols?: string) {
      return {
        eq(col: string, val: unknown) {
          return buildFilterChain((row) => row[col] === val);
        },
      };
    },
  };

  function buildFilterChain(predicate: (row: StoredRow) => boolean) {
    const filters: Array<(row: StoredRow) => boolean> = [predicate];
    const chain = {
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return chain;
      },
      gte(col: string, val: string) {
        filters.push((row) => String(row[col]) >= val);
        return chain;
      },
      lte(col: string, val: string) {
        filters.push((row) => String(row[col]) <= val);
        return chain;
      },
      order(_col: string, _opts?: { ascending: boolean }) {
        return chain;
      },
      limit(n: number) {
        const data = store.filter((row) => filters.every((f) => f(row))).slice(0, n);
        return Promise.resolve({ data, error: null });
      },
    };
    return chain;
  }

  function emptyLinkContextChain() {
    const result = Promise.resolve({ data: [] as StoredRow[], error: null });
    const chain = {
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      then: result.then.bind(result),
      catch: result.catch.bind(result),
      finally: result.finally.bind(result),
    };
    return { select: () => chain };
  }

  const client = {
    from(table: string) {
      if (table === "fi_analytics_events") return api;
      if (table === "fi_cases" || table === "fi_reports" || table === "fi_global_cases") {
        return emptyLinkContextChain();
      }
      return api;
    },
  } as unknown as SupabaseClient;

  return client;
}

describe("loadSurgeryIntelligenceDashboard", () => {
  it("loads and aggregates tenant-scoped published facts", async () => {
    const store = [
      makeEventRow({ tenantId: TENANT_A, occurredAt: "2026-07-04T10:00:00.000Z", hasFinal: true, graftCount: 120 }),
      makeEventRow({ tenantId: TENANT_B, occurredAt: "2026-07-04T11:00:00.000Z", hasFinal: true, graftCount: 999 }),
    ];
    const client = createAnalyticsEventsMock(store);

    const payload = await loadSurgeryIntelligenceDashboard(
      { tenantId: TENANT_A, filters: {} },
      { supabaseClientForTests: client }
    );

    assert.equal(payload.metrics.totalReviewedCasesWithFinalCount, 1);
    assert.equal(payload.metrics.totalFinalReviewedGraftCount, 120);
  });

  it("applies published date filters via analytics query", async () => {
    const store = [
      makeEventRow({
        tenantId: TENANT_A,
        occurredAt: "2026-06-01T10:00:00.000Z",
        hasFinal: true,
        graftCount: 40,
      }),
      makeEventRow({
        tenantId: TENANT_A,
        occurredAt: "2026-07-04T10:00:00.000Z",
        hasFinal: true,
        graftCount: 120,
      }),
    ];
    const client = createAnalyticsEventsMock(store);

    const payload = await loadSurgeryIntelligenceDashboard(
      {
        tenantId: TENANT_A,
        filters: {
          occurredAfter: "2026-07-01T00:00:00.000Z",
          occurredBefore: "2026-07-31T23:59:59.999Z",
        },
      },
      { supabaseClientForTests: client }
    );

    assert.equal(payload.eventCountLoaded, 1);
    assert.equal(payload.metrics.totalFinalReviewedGraftCount, 120);
  });
});