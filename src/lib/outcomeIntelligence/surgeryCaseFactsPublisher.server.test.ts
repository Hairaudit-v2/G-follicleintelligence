import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapSurgeryCaseIntelligenceFacts,
  SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
  type SurgeryCaseFactsInput,
} from "./surgeryCaseFactsCore";
import {
  publishSurgeryCaseIntelligenceFacts,
  SurgeryCaseFactsPublishValidationError,
} from "./surgeryCaseFactsPublisher.server";
import { SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE } from "./surgeryCaseFactsPublisherCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const CASE = "22222222-2222-4222-8222-222222222222";
const SURGERY = "44444444-4444-4444-8444-444444444444";
const LINK = "66666666-6666-4666-8666-666666666666";
const IMAGE = "77777777-7777-4777-8777-777777777777";
const ESTIMATE = "88888888-8888-4888-8888-888888888888";

type StoredRow = Record<string, unknown>;

function reviewedFacts() {
  const input: SurgeryCaseFactsInput = {
    tenantId: TENANT,
    patientId: PATIENT,
    caseId: CASE,
    surgeryId: SURGERY,
    bookingId: null,
    procedureDate: "2026-07-04",
    surgeonFiUserId: null,
    graftSessionId: "99999999-9999-4999-8999-999999999999",
    targetGrafts: 3000,
    extractedGrafts: 1200,
    implantedGrafts: 0,
    discardedGrafts: 0,
    remainingGrafts: 1200,
    reconciliationStatus: "pending",
    graftSessionPhase: "extraction",
    reconciledAt: null,
    confirmedTrayGrafts: 120,
    trayImageLinks: [
      {
        linkId: LINK,
        imageId: IMAGE,
        intelligenceSummary: {
          estimateId: ESTIMATE,
          graftTrayLinkId: LINK,
          hasFinalCount: true,
          finalAcceptedCount: 120,
          originalAiEstimate: 120,
          manualCount: 118,
          mismatchBand: "within_tolerance",
          confidenceBand: "high",
          imageQuality: "suitable",
          reviewerId: "staff-1",
          reviewerLabel: "Reviewer",
          reviewedAt: "2026-07-04T12:05:00.000Z",
          finalCountSource: "ai",
          supersededStaleJob: false,
          reviewStatus: "accepted_ai",
        },
      },
    ],
    graftTrayIntelligence: {
      reviewedTrayCount: 1,
      pendingReviewCount: 0,
      supersededStaleCount: 0,
      totalFinalAcceptedGrafts: 120,
      hasSupersededStaleEstimate: false,
    },
  };
  const facts = mapSurgeryCaseIntelligenceFacts(input);
  assert.ok(facts);
  return facts;
}

function createAnalyticsEventsMock(initial: StoredRow[] = []) {
  const store = [...initial];

  const api = {
    insert(row: StoredRow) {
      const id = randomUUID();
      const full: StoredRow = {
        ...row,
        id,
        created_at: new Date().toISOString(),
      };
      store.push(full);
      return {
        select() {
          return {
            single() {
              return Promise.resolve({ data: full, error: null });
            },
          };
        },
      };
    },
    update(patch: StoredRow) {
      return {
        eq(col: string, val: unknown) {
          return {
            eq(col2: string, val2: unknown) {
              return {
                select() {
                  return {
                    single() {
                      const idx = store.findIndex((row) => row[col] === val && row[col2] === val2);
                      if (idx < 0) {
                        return Promise.resolve({
                          data: null,
                          error: { message: "not found" },
                        });
                      }
                      store[idx] = { ...store[idx], ...patch };
                      return Promise.resolve({ data: store[idx], error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
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

  const client = {
    from(table: string) {
      assert.equal(table, "fi_analytics_events");
      return api;
    },
  } as unknown as SupabaseClient;

  return { client, store };
}

describe("publishSurgeryCaseIntelligenceFacts", () => {
  it("inserts reviewed facts event with audit metadata", async () => {
    const { client, store } = createAnalyticsEventsMock();
    const facts = reviewedFacts();
    const result = await publishSurgeryCaseIntelligenceFacts(
      { tenantId: TENANT, facts },
      { supabaseClientForTests: client }
    );

    assert.equal(result.action, "inserted");
    assert.equal(store.length, 1);
    const row = store[0]!;
    assert.equal(row.module_name, "surgery_os");
    assert.equal(row.event_type, SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE);
    assert.equal(row.entity_id, CASE);
    assert.equal(row.entity_type, "case");
    assert.equal(row.event_value, 120);
    const metadata = row.event_metadata as Record<string, unknown>;
    assert.equal(metadata.source, "surgery_case_intelligence");
    assert.equal(metadata.facts_version, SURGERY_CASE_INTELLIGENCE_FACTS_VERSION);
    assert.equal(metadata.surgery_id, SURGERY);
  });

  it("republishing same facts_version updates existing row idempotently", async () => {
    const facts = reviewedFacts();
    const { client, store } = createAnalyticsEventsMock();
    const first = await publishSurgeryCaseIntelligenceFacts(
      { tenantId: TENANT, facts },
      { supabaseClientForTests: client }
    );
    assert.equal(first.action, "inserted");

    const updatedFacts = { ...facts, extracted_grafts: 1500 };
    const second = await publishSurgeryCaseIntelligenceFacts(
      { tenantId: TENANT, facts: updatedFacts },
      { supabaseClientForTests: client }
    );
    assert.equal(second.action, "updated");
    assert.equal(store.length, 1);
    const payload = (store[0]!.event_metadata as Record<string, unknown>).payload_json as {
      extracted_grafts: number;
    };
    assert.equal(payload.extracted_grafts, 1500);
  });

  it("skips older facts_version when newer already published", async () => {
    const facts = reviewedFacts();
    const { client } = createAnalyticsEventsMock([
      {
        id: randomUUID(),
        tenant_id: TENANT,
        module_name: "surgery_os",
        event_type: SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE,
        entity_id: CASE,
        event_metadata: { facts_version: "surgery_case_intelligence_facts_v2" },
      },
    ]);

    const result = await publishSurgeryCaseIntelligenceFacts(
      { tenantId: TENANT, facts },
      { supabaseClientForTests: client }
    );
    assert.equal(result.action, "skipped");
  });

  it("rejects invalid payload before write", async () => {
    const facts = reviewedFacts();
    const { client, store } = createAnalyticsEventsMock();
    await assert.rejects(
      () =>
        publishSurgeryCaseIntelligenceFacts(
          {
            tenantId: TENANT,
            facts: { ...facts, tenant_id: "not-a-uuid" },
          },
          { supabaseClientForTests: client }
        ),
      SurgeryCaseFactsPublishValidationError
    );
    assert.equal(store.length, 0);
  });
});
