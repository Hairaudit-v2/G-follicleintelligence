import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateSurgeryIntelligenceBackfillSummary,
  classifyDryRunPublishDecision,
  classifyWritePublishResult,
  filterSurgeriesForBackfillScope,
  resolveSurgeryIntelligenceBackfillDateRange,
} from "./surgeryIntelligenceBackfillCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SURGERY_A = "44444444-4444-4444-8444-444444444444";
const SURGERY_B = "55555555-5555-4555-8555-555555555555";
const CASE = "33333333-3333-4333-8333-333333333333";

function surgeryRow(id: string, scheduledDate: string, caseId: string | null = CASE) {
  return { id, tenant_id: TENANT, case_id: caseId, scheduled_date: scheduledDate };
}

describe("surgeryIntelligenceBackfillCore", () => {
  it("date range filter keeps surgeries in scope", () => {
    const rows = [surgeryRow(SURGERY_A, "2026-06-15"), surgeryRow(SURGERY_B, "2026-07-10")];
    const filtered = filterSurgeriesForBackfillScope(rows, {
      procedureDateFrom: "2026-07-01",
      procedureDateTo: "2026-07-31",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, SURGERY_B);
  });

  it("resolveSurgeryIntelligenceBackfillDateRange validates bounds", () => {
    assert.deepEqual(
      resolveSurgeryIntelligenceBackfillDateRange({
        procedureDateFrom: "2026-07-01",
        procedureDateTo: "2026-07-31",
      }),
      { from: "2026-07-01", to: "2026-07-31" }
    );
    assert.equal(
      "error" in
        resolveSurgeryIntelligenceBackfillDateRange({
          procedureDateFrom: "2026-07-31",
          procedureDateTo: "2026-07-01",
        }),
      true
    );
  });

  it("aggregates operator summary counts", () => {
    const summary = aggregateSurgeryIntelligenceBackfillSummary({
      dryRun: true,
      scanned: 4,
      outcomes: [
        { kind: "published", surgeryId: SURGERY_A, caseId: CASE, action: "inserted", dryRun: true },
        { kind: "updated", surgeryId: SURGERY_B, caseId: CASE, dryRun: true },
        { kind: "skipped_no_final_count", surgeryId: "s-3", caseId: CASE },
        { kind: "skipped_missing_context", surgeryId: "s-4", caseId: null },
        {
          kind: "skipped_newer_version",
          surgeryId: "s-5",
          caseId: CASE,
          reason: "newer",
        },
        { kind: "failed", surgeryId: "s-6", caseId: null, reason: "boom" },
      ],
    });

    assert.equal(summary.scanned, 4);
    assert.equal(summary.eligible, 3);
    assert.equal(summary.published, 1);
    assert.equal(summary.updated, 1);
    assert.equal(summary.skippedNoFinalCount, 1);
    assert.equal(summary.skippedMissingContext, 1);
    assert.equal(summary.skippedNewerVersion, 1);
    assert.equal(summary.failed, 1);
  });

  it("classifies dry-run and write publish results", () => {
    assert.equal(
      classifyDryRunPublishDecision({
        surgeryId: SURGERY_A,
        caseId: CASE,
        decision: { action: "insert" },
      }).kind,
      "published"
    );
    assert.equal(
      classifyWritePublishResult({
        surgeryId: SURGERY_A,
        caseId: CASE,
        result: {
          action: "updated",
          factsVersion: "surgery_case_intelligence_facts_v1",
          lastPublishedAt: "2026-07-04T10:00:00.000Z",
        },
      }).kind,
      "updated"
    );
  });
});
