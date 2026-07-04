import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SURGERY_CASE_INTELLIGENCE_FACTS_VERSION } from "./surgeryCaseFactsCore";
import {
  processSurgeryCaseIntelligenceBackfillItem,
  runSurgeryIntelligenceBackfill,
} from "./surgeryIntelligenceBackfill.server";
import type { SurgeryCaseIntelligenceFacts } from "./surgeryCaseFactsCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SURGERY = "44444444-4444-4444-8444-444444444444";
const CASE = "33333333-3333-4333-8333-333333333333";

function reviewedFacts(): SurgeryCaseIntelligenceFacts {
  return {
    facts_version: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
    tenant_id: TENANT,
    patient_id: null,
    case_id: CASE,
    surgery_id: SURGERY,
    booking_id: null,
    procedure_date: "2026-07-04",
    final_reviewed_graft_count: 120,
    graft_tray_ai_estimate: 120,
    graft_tray_manual_count: 118,
    graft_count_source: "ai",
    mismatch_band: "within_tolerance",
    confidence_band: "high",
    image_quality: "suitable",
    reviewer_id: null,
    reviewer_label: null,
    reviewed_at: null,
    has_final_graft_count: true,
    graft_tray_review_pending: false,
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
  };
}

function pendingFacts(): SurgeryCaseIntelligenceFacts {
  return {
    ...reviewedFacts(),
    has_final_graft_count: false,
    final_reviewed_graft_count: null,
    graft_count_source: null,
    graft_tray_review_pending: true,
  };
}

const noopClient = {} as SupabaseClient;

function createSurgeriesMock(rows: Array<Record<string, unknown>>) {
  const client = {
    from(table: string) {
      assert.equal(table, "fi_surgeries");
      return {
        select() {
          return {
            eq(col: string, _val: unknown) {
              if (col === "tenant_id") {
                return {
                  eq(col2: string, val2: unknown) {
                    assert.equal(col2, "id");
                    const row = rows.find((r) => r.id === val2);
                    return {
                      maybeSingle() {
                        return Promise.resolve({ data: row ?? null, error: null });
                      },
                    };
                  },
                  order() {
                    return {
                      limit() {
                        return {
                          gte() {
                            return {
                              lte() {
                                return Promise.resolve({ data: rows, error: null });
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                  gte() {
                    return {
                      lte() {
                        return {
                          order() {
                            return {
                              limit() {
                                return Promise.resolve({ data: rows, error: null });
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              }
              throw new Error(`unexpected eq ${col}`);
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return client;
}

describe("surgeryIntelligenceBackfill.server", () => {
  it("dry-run does not write", async () => {
    let publishCalls = 0;
    const outcome = await processSurgeryCaseIntelligenceBackfillItem(
      {
        tenantId: TENANT,
        surgeryId: SURGERY,
        dryRun: true,
        client: noopClient,
      },
      {
        loadFacts: async () => ({ facts: reviewedFacts(), clinicId: null }),
        publishFacts: async () => {
          publishCalls += 1;
          return {
            action: "inserted",
            factsVersion: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
            lastPublishedAt: "2026-07-04T10:00:00.000Z",
          };
        },
        loadExistingRows: async () => [],
      }
    );

    assert.equal(publishCalls, 0);
    assert.equal(outcome.kind, "published");
    assert.equal("dryRun" in outcome && outcome.dryRun, true);
  });

  it("reviewed historical case publishes", async () => {
    let published = false;
    const outcome = await processSurgeryCaseIntelligenceBackfillItem(
      {
        tenantId: TENANT,
        surgeryId: SURGERY,
        dryRun: false,
        client: noopClient,
      },
      {
        loadFacts: async () => ({ facts: reviewedFacts(), clinicId: null }),
        publishFacts: async () => {
          published = true;
          return {
            action: "inserted",
            factsVersion: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
            lastPublishedAt: "2026-07-04T10:00:00.000Z",
          };
        },
      }
    );

    assert.equal(published, true);
    assert.equal(outcome.kind, "published");
  });

  it("pending/unreviewed case skipped", async () => {
    const outcome = await processSurgeryCaseIntelligenceBackfillItem(
      {
        tenantId: TENANT,
        surgeryId: SURGERY,
        dryRun: false,
        client: noopClient,
      },
      {
        loadFacts: async () => ({ facts: pendingFacts(), clinicId: null }),
        publishFacts: async () => {
          throw new Error("should not publish");
        },
      }
    );

    assert.equal(outcome.kind, "skipped_no_final_count");
  });

  it("idempotent re-run updates safely", async () => {
    const outcome = await processSurgeryCaseIntelligenceBackfillItem(
      {
        tenantId: TENANT,
        surgeryId: SURGERY,
        dryRun: false,
        client: noopClient,
      },
      {
        loadFacts: async () => ({ facts: reviewedFacts(), clinicId: null }),
        publishFacts: async () => ({
          action: "updated",
          factsVersion: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
          lastPublishedAt: "2026-07-04T11:00:00.000Z",
        }),
      }
    );

    assert.equal(outcome.kind, "updated");
  });

  it("date range scan filters surgeries", async () => {
    const client = createSurgeriesMock([
      {
        id: SURGERY,
        tenant_id: TENANT,
        case_id: CASE,
        scheduled_date: "2026-07-04",
      },
    ]);

    const result = await runSurgeryIntelligenceBackfill(
      {
        tenantId: TENANT,
        scope: {
          dryRun: true,
          procedureDateFrom: "2026-07-01",
          procedureDateTo: "2026-07-31",
        },
        client,
      },
      {
        loadFacts: async () => ({ facts: reviewedFacts(), clinicId: null }),
        loadExistingRows: async () => [],
      }
    );

    assert.equal(result.summary.scanned, 1);
    assert.equal(result.summary.published, 1);
  });
});