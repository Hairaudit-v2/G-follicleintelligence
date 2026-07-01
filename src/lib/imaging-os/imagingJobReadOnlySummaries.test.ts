import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clinicalAnalysisResultToMetadataRecord } from "./clinicalImageAnalysisCore";
import { buildClinicalImageAnalysisFromHli } from "./clinicalImageAnalysisCore";
import {
  buildDensityEstimateSummary,
  buildNorwoodGradeSummary,
  buildOutcomeScoreSummary,
  mergeImagingJobSummariesMetadata,
  outcomeScoreSummaryIsStaffSafe,
} from "./imagingJobReadOnlySummaries";

describe("imagingJobReadOnlySummaries", () => {
  it("density estimate unavailable for non-donor views", () => {
    const summary = buildDensityEstimateSummary({
      metadata: {},
      aiImageCategory: "front",
    });
    assert.equal(summary.summary_status, "unavailable");
    assert.equal(summary.review_required, true);
    assert.ok(summary.limitations.length > 0);
  });

  it("density estimate needs review for donor context with low confidence", () => {
    const clinical = clinicalAnalysisResultToMetadataRecord(
      buildClinicalImageAnalysisFromHli({
        hliCategory: "donor",
        categoryConfidence: 0.5,
        notes: "donor",
      })
    );
    const summary = buildDensityEstimateSummary({
      metadata: { imaging_clinical_ai: clinical },
      aiImageCategory: "donor",
      aiImageCategoryConfidence: 0.5,
    });
    assert.equal(summary.summary_status, "needs_review");
    assert.equal(summary.review_required, true);
  });

  it("norwood summary uses patient record when available", () => {
    const clinical = clinicalAnalysisResultToMetadataRecord(
      buildClinicalImageAnalysisFromHli({
        hliCategory: "front",
        categoryConfidence: 0.85,
        notes: "front",
      })
    );
    const summary = buildNorwoodGradeSummary({
      metadata: { imaging_clinical_ai: { ...clinical, view_type: "front" } },
      patientNorwoodScale: "III",
      aiImageCategoryConfidence: 0.85,
    });
    assert.equal(summary.summary_status, "complete");
    assert.ok(summary.observations.some((o) => o.includes("III")));
  });

  it("outcome_score unavailable when provider unsupported", () => {
    const summary = buildOutcomeScoreSummary({
      metadata: {},
      providerSupported: false,
    });
    assert.equal(summary.summary_status, "unavailable");
    assert.equal(summary.review_required, true);
    assert.ok(outcomeScoreSummaryIsStaffSafe(summary));
    assert.ok(summary.limitations.some((l) => /not a predictive simulation/i.test(l)));
  });

  it("outcome_score needs review when confidence low", () => {
    const clinical = clinicalAnalysisResultToMetadataRecord(
      buildClinicalImageAnalysisFromHli({
        hliCategory: "front",
        categoryConfidence: 0.3,
        notes: "low",
      })
    );
    const summary = buildOutcomeScoreSummary({
      metadata: { imaging_clinical_ai: clinical },
      providerSupported: true,
      aiImageCategoryConfidence: 0.3,
    });
    assert.equal(summary.summary_status, "needs_review");
    assert.equal(summary.review_required, true);
  });

  it("outcome_score metadata write-back preserves clinical AI", () => {
    const summary = buildOutcomeScoreSummary({ metadata: {}, providerSupported: false });
    const merged = mergeImagingJobSummariesMetadata(
      { imaging_clinical_ai: { provider: "stub", status: "complete" } },
      { outcome_score: summary }
    );
    assert.deepEqual(merged.imaging_clinical_ai, { provider: "stub", status: "complete" });
    assert.ok((merged.imaging_job_summaries as { outcome_score?: unknown }).outcome_score);
  });

  it("merges job summaries without overwriting clinical AI", () => {
    const merged = mergeImagingJobSummariesMetadata(
      { imaging_clinical_ai: { provider: "stub", status: "complete" } },
      {
        density_estimate: {
          summary_status: "unavailable",
          confidence: 0,
          observations: [],
          review_required: true,
          limitations: ["test"],
          summary_version: "imagingos_job_summary_v1",
          generated_at: "2026-01-01T00:00:00.000Z",
        },
      }
    );
    assert.deepEqual(merged.imaging_clinical_ai, { provider: "stub", status: "complete" });
    assert.ok(merged.imaging_job_summaries);
  });
});