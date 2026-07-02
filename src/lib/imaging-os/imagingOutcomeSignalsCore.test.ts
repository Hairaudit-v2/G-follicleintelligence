import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clinicalAnalysisResultToMetadataRecord } from "./clinicalImageAnalysisCore";
import { buildClinicalImageAnalysisFromHli } from "./clinicalImageAnalysisCore";
import {
  buildLiveDensitySignalSummary,
  buildLiveOutcomeScoreSignalSummary,
  IMAGINGOS_OUTCOME_SIGNALS_VERSION,
  mergeOutcomeSignalsMetadata,
  parseImagingLiveProviderFlags,
} from "./imagingOutcomeSignalsCore";

describe("imagingOutcomeSignalsCore", () => {
  const donorClinical = clinicalAnalysisResultToMetadataRecord(
    buildClinicalImageAnalysisFromHli({
      hliCategory: "donor",
      categoryConfidence: 0.9,
      notes: "donor",
    })
  );

  it("feature flag off returns unavailable for density", () => {
    const flags = parseImagingLiveProviderFlags({
      FI_IMAGING_ENABLE_LIVE_DENSITY_PROVIDER: "false",
      FI_IMAGING_ENABLE_LIVE_OUTCOME_PROVIDER: "false",
    });
    assert.equal(flags.liveDensityEnabled, false);
    const summary = buildLiveDensitySignalSummary({
      metadata: { imaging_clinical_ai: donorClinical },
      aiImageCategory: "donor",
      liveEnabled: flags.liveDensityEnabled,
      providerAvailable: true,
      providerName: "hli_vision",
    });
    assert.equal(summary.summary_status, "unavailable");
    assert.equal(summary.provider, "unavailable");
    assert.ok(summary.limitations.some((l) => /disabled/i.test(l)));
  });

  it("feature flag on with provider available produces complete density signal", () => {
    const flags = parseImagingLiveProviderFlags({
      FI_IMAGING_ENABLE_LIVE_DENSITY_PROVIDER: "true",
    });
    assert.equal(flags.liveDensityEnabled, true);
    const summary = buildLiveDensitySignalSummary({
      metadata: { imaging_clinical_ai: donorClinical },
      aiImageCategory: "donor",
      aiImageCategoryConfidence: 0.9,
      liveEnabled: true,
      providerAvailable: true,
      providerName: "hli_vision",
    });
    assert.equal(summary.summary_status, "complete");
    assert.equal(summary.provider, "hli_vision");
    assert.equal(summary.summary_version, IMAGINGOS_OUTCOME_SIGNALS_VERSION);
    assert.ok(summary.observations.length > 0);
  });

  it("provider unavailable degrades safely when flag on", () => {
    const summary = buildLiveDensitySignalSummary({
      metadata: { imaging_clinical_ai: donorClinical },
      aiImageCategory: "donor",
      liveEnabled: true,
      providerAvailable: false,
      providerName: "unavailable",
    });
    assert.equal(summary.summary_status, "unavailable");
    assert.equal(summary.provider, "unavailable");
    assert.equal(summary.review_required, true);
  });

  it("low confidence sets needs_review for outcome score", () => {
    const clinical = clinicalAnalysisResultToMetadataRecord(
      buildClinicalImageAnalysisFromHli({
        hliCategory: "front",
        categoryConfidence: 0.4,
        notes: "front",
      })
    );
    const summary = buildLiveOutcomeScoreSignalSummary({
      metadata: { imaging_clinical_ai: clinical },
      aiImageCategoryConfidence: 0.4,
      liveEnabled: true,
      providerAvailable: true,
      providerName: "stub",
    });
    assert.equal(summary.summary_status, "needs_review");
    assert.equal(summary.review_required, true);
  });

  it("mergeOutcomeSignalsMetadata preserves existing imaging_job_summaries", () => {
    const existing = {
      imaging_job_summaries: {
        norwood_grade: {
          summary_status: "complete",
          confidence: 0.9,
          observations: ["Norwood III"],
          review_required: false,
          limitations: [],
          summary_version: "imagingos_job_summary_v1",
          generated_at: "2026-01-01T00:00:00.000Z",
        },
      },
      imaging_clinical_ai: donorClinical,
    };
    const density = buildLiveDensitySignalSummary({
      metadata: existing,
      aiImageCategory: "donor",
      liveEnabled: true,
      providerAvailable: true,
      providerName: "stub",
    });
    const merged = mergeOutcomeSignalsMetadata(existing, { density_estimate: density });
    const summaries = merged.imaging_job_summaries as Record<string, unknown>;
    assert.ok(summaries.norwood_grade);
    assert.equal((summaries.density_estimate as { provider: string }).provider, "stub");
    assert.deepEqual(merged.imaging_clinical_ai, donorClinical);
  });
});