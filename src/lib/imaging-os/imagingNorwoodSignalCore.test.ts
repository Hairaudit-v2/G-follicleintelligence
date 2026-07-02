import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clinicalAnalysisResultToMetadataRecord } from "./clinicalImageAnalysisCore";
import { buildClinicalImageAnalysisFromHli } from "./clinicalImageAnalysisCore";
import {
  buildLiveNorwoodSignalSummary,
  IMAGINGOS_NORWOOD_SIGNAL_VERSION,
  parseImagingNorwoodProviderFlag,
} from "./imagingNorwoodSignalCore";
import {
  buildPatientSafeImagingExportCard,
  patientSafeExportCardIsRedacted,
} from "./patientSafeImagingExportCore";

describe("imagingNorwoodSignalCore", () => {
  const frontClinical = clinicalAnalysisResultToMetadataRecord(
    buildClinicalImageAnalysisFromHli({
      hliCategory: "front",
      categoryConfidence: 0.9,
      notes: "front",
    })
  );

  it("flag off returns unavailable", () => {
    assert.equal(parseImagingNorwoodProviderFlag({}), false);
    const summary = buildLiveNorwoodSignalSummary({
      metadata: { imaging_clinical_ai: frontClinical },
      aiImageCategory: "front",
      liveEnabled: false,
      providerAvailable: true,
      providerName: "hli_vision",
    });
    assert.equal(summary.summary_status, "unavailable");
    assert.equal(summary.provider, "unavailable");
  });

  it("flag on with provider produces complete signal", () => {
    assert.equal(
      parseImagingNorwoodProviderFlag({ FI_IMAGING_ENABLE_LIVE_NORWOOD_PROVIDER: "true" }),
      true
    );
    const summary = buildLiveNorwoodSignalSummary({
      metadata: { imaging_clinical_ai: frontClinical },
      aiImageCategory: "front",
      aiImageCategoryConfidence: 0.9,
      liveEnabled: true,
      providerAvailable: true,
      providerName: "stub",
    });
    assert.equal(summary.summary_status, "complete");
    assert.equal(summary.summary_version, IMAGINGOS_NORWOOD_SIGNAL_VERSION);
    assert.ok(summary.limitations.some((l) => /not a diagnosis/i.test(l)));
  });

  it("provider unavailable degrades safely", () => {
    const summary = buildLiveNorwoodSignalSummary({
      metadata: { imaging_clinical_ai: frontClinical },
      aiImageCategory: "front",
      liveEnabled: true,
      providerAvailable: false,
      providerName: "unavailable",
    });
    assert.equal(summary.summary_status, "unavailable");
    assert.equal(summary.review_required, true);
  });

  it("low confidence sets needs_review", () => {
    const clinical = clinicalAnalysisResultToMetadataRecord(
      buildClinicalImageAnalysisFromHli({
        hliCategory: "front",
        categoryConfidence: 0.4,
        notes: "front",
      })
    );
    const summary = buildLiveNorwoodSignalSummary({
      metadata: { imaging_clinical_ai: clinical },
      aiImageCategoryConfidence: 0.4,
      liveEnabled: true,
      providerAvailable: true,
      providerName: "stub",
    });
    assert.equal(summary.summary_status, "needs_review");
  });

  it("patient-safe export excludes Norwood wording", () => {
    const card = buildPatientSafeImagingExportCard({
      imageId: "img-1",
      viewLabel: "Front view",
      metadata: {},
    });
    assert.ok(patientSafeExportCardIsRedacted(card));
    const bad = buildPatientSafeImagingExportCard({
      imageId: "img-2",
      viewLabel: "Norwood III area",
      metadata: {},
    });
    assert.equal(patientSafeExportCardIsRedacted(bad), false);
  });
});