import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapEstimateRowToSummary,
  parseGraftTrayAiEstimateRow,
} from "@/src/lib/imaging-os/graftTrayAiEstimateRowParser";
import { graftTrayAiEstimateSummarySchema } from "./surgeryOsBoardPayloadSchema";
import { mapGraftTrayAiEstimateToSurgeryOsSummary } from "./surgeryOsGraftTrayAiCore";
import type { SurgeryOsGraftTrayAiEstimateSummary } from "./surgeryOsBoardModel.types";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const ESTIMATE = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-07-04T12:00:00.000Z";

function validImagingSummary() {
  const row = parseGraftTrayAiEstimateRow({
    id: ESTIMATE,
    tenant_id: TENANT,
    patient_id: PATIENT,
    image_id: IMAGE,
    graft_tray_link_id: null,
    surgery_id: null,
    estimated_graft_count: 120,
    manual_graft_count: 118,
    manual_count_source: "confirmed_tray_latest",
    corrected_graft_count: null,
    delta: 2,
    mismatch_band: "within_tolerance",
    confidence: 0.82,
    confidence_band: "high",
    image_quality: "suitable",
    assessable: true,
    review_status: "pending_review",
    reviewer_decision: null,
    provider: "stub",
    provider_version: "graft_tray_stub_v1",
    review_reasons: ["graft_tray_ai_count_needs_review"],
    created_at: NOW,
    updated_at: NOW,
  });
  return mapEstimateRowToSummary(row);
}

describe("mapGraftTrayAiEstimateToSurgeryOsSummary", () => {
  it("maps valid parsed ImagingOS estimate summary to SurgeryOS camelCase fields", () => {
    const imaging = validImagingSummary();
    const surgery = mapGraftTrayAiEstimateToSurgeryOsSummary(imaging);

    assert.deepEqual(surgery, {
      estimateId: ESTIMATE,
      estimatedGraftCount: 120,
      manualGraftCount: 118,
      mismatchBand: "within_tolerance",
      delta: 2,
      confidence: 0.82,
      confidenceBand: "high",
      reviewStatus: "pending_review",
      reviewerDecision: null,
      correctedCount: null,
      provider: "stub",
    } satisfies SurgeryOsGraftTrayAiEstimateSummary);
  });

  it("preserves representative accepted_ai output for valid inputs", () => {
    const row = parseGraftTrayAiEstimateRow({
      id: ESTIMATE,
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      graft_tray_link_id: null,
      surgery_id: null,
      estimated_graft_count: 120,
      manual_graft_count: 118,
      manual_count_source: "confirmed_tray_latest",
      corrected_graft_count: 119,
      delta: 2,
      mismatch_band: "minor_mismatch",
      confidence: 0.82,
      confidence_band: "medium",
      image_quality: "marginal",
      assessable: true,
      review_status: "accepted_ai",
      reviewer_decision: "accept_ai_estimate",
      provider: "openai_vision",
      provider_version: "graft_tray_openai_v1",
      review_reasons: ["graft_tray_ai_count_needs_review"],
      created_at: NOW,
      updated_at: NOW,
    });
    const imaging = mapEstimateRowToSummary(row);

    assert.deepEqual(mapGraftTrayAiEstimateToSurgeryOsSummary(imaging), {
      estimateId: ESTIMATE,
      estimatedGraftCount: 120,
      manualGraftCount: 118,
      mismatchBand: "minor_mismatch",
      delta: 2,
      confidence: 0.82,
      confidenceBand: "medium",
      reviewStatus: "accepted_ai",
      reviewerDecision: "accept_ai_estimate",
      correctedCount: 119,
      provider: "openai_vision",
    });
  });
});

describe("graftTrayAiEstimateSummarySchema", () => {
  it("accepts valid SurgeryOS graft tray AI summary enums", () => {
    const parsed = graftTrayAiEstimateSummarySchema.parse(
      mapGraftTrayAiEstimateToSurgeryOsSummary(validImagingSummary())
    );
    assert.equal(parsed.mismatchBand, "within_tolerance");
    assert.equal(parsed.provider, "stub");
  });

  it("rejects invalid mismatch_band strings at the SurgeryOS payload boundary", () => {
    const valid = mapGraftTrayAiEstimateToSurgeryOsSummary(validImagingSummary());
    const result = graftTrayAiEstimateSummarySchema.safeParse({
      ...valid,
      mismatchBand: "totally_invalid",
    });
    assert.equal(result.success, false);
  });

  it("rejects invalid reviewStatus strings at the SurgeryOS payload boundary", () => {
    const valid = mapGraftTrayAiEstimateToSurgeryOsSummary(validImagingSummary());
    const result = graftTrayAiEstimateSummarySchema.safeParse({
      ...valid,
      reviewStatus: "auto_approved",
    });
    assert.equal(result.success, false);
  });

  it("rejects invalid provider strings at the SurgeryOS payload boundary", () => {
    const valid = mapGraftTrayAiEstimateToSurgeryOsSummary(validImagingSummary());
    const result = graftTrayAiEstimateSummarySchema.safeParse({
      ...valid,
      provider: "mystery_vendor",
    });
    assert.equal(result.success, false);
  });
});