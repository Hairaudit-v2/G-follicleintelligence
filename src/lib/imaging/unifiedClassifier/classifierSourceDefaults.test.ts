import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySourceDefaults,
  classifyUnifiedImageRequest,
} from "./unifiedImageClassifyService.server";
import type { UnifiedImageClassifyRequest } from "./unifiedImageClassifyRequest";

const BASE_REQUEST = {
  source_image_id: "img-1",
  signed_url: "https://example.test/a.jpg",
} as const;

function fiOsRequest(
  overrides: Partial<UnifiedImageClassifyRequest> = {}
): UnifiedImageClassifyRequest {
  return {
    source_system: "fi_os",
    ...BASE_REQUEST,
    ...overrides,
  };
}

describe("applySourceDefaults", () => {
  it("FI OS request with no capture_source defaults to imaging_os_wizard", () => {
    const mapped = applySourceDefaults(
      fiOsRequest({
        upload_source: "fi_os",
      })
    );
    assert.equal(mapped.capture_source, "imaging_os_wizard");
    assert.equal(mapped.upload_source, "fi_os");
  });

  it("FI OS guided_capture normalizes to imaging_os_wizard", () => {
    const mapped = applySourceDefaults(
      fiOsRequest({
        capture_source: "guided_capture",
        upload_source: "fi_os",
      })
    );
    assert.equal(mapped.capture_source, "imaging_os_wizard");
  });

  it("FI OS vie_guided alias normalizes to vie_capture_wizard", () => {
    const mapped = applySourceDefaults(
      fiOsRequest({
        capture_source: "vie_guided",
        upload_source: "fi_os",
      })
    );
    assert.equal(mapped.capture_source, "vie_capture_wizard");
  });

  it("FI OS preserves explicit imaging_os_wizard capture_source", () => {
    const mapped = applySourceDefaults(
      fiOsRequest({
        capture_source: "imaging_os_wizard",
        upload_source: "fi_os",
      })
    );
    assert.equal(mapped.capture_source, "imaging_os_wizard");
  });

  it("hairaudit defaults remain unchanged", () => {
    const mapped = applySourceDefaults({
      source_system: "hairaudit",
      ...BASE_REQUEST,
      canonical_photo_category: "patient_current_front",
    });
    assert.equal(mapped.capture_source, "forensic_audit");
    assert.equal(mapped.upload_source, "hairaudit");
  });

  it("hli defaults remain unchanged", () => {
    const mapped = applySourceDefaults({
      source_system: "hli",
      ...BASE_REQUEST,
      patient_id: "hli-patient-1",
    });
    assert.equal(mapped.capture_source, "patient_portal");
    assert.equal(mapped.upload_source, "hli");
  });

  it("iiohr defaults and metadata enrichment remain unchanged", () => {
    const mapped = applySourceDefaults({
      source_system: "iiohr",
      ...BASE_REQUEST,
      case_id: "academy-case-42",
      professional_id: "prof-9",
      metadata: { academy_module: "graft_planning" },
    });
    assert.equal(mapped.capture_source, "clinic_staff");
    assert.equal(mapped.upload_source, "iiohr");
    assert.equal(mapped.metadata?.academy_case_id, "academy-case-42");
    assert.equal(mapped.metadata?.professional_id, "prof-9");
    assert.equal(mapped.metadata?.academy_module, "graft_planning");
  });

  it("preserves explicit capture_source overrides for non-fi_os systems", () => {
    const mapped = applySourceDefaults({
      source_system: "hairaudit",
      ...BASE_REQUEST,
      capture_source: "surgery_os",
      upload_source: "hairaudit",
    });
    assert.equal(mapped.capture_source, "surgery_os");
    assert.equal(mapped.upload_source, "hairaudit");
  });
});

describe("classifier source defaults preserve contract output", () => {
  it("fi_os representative input keeps guided_capture contract mapping", async () => {
    const outcome = await classifyUnifiedImageRequest(
      fiOsRequest({
        capture_source: "guided_capture",
        upload_source: "fi_os",
      })
    );
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.result.classification.capture_source, "guided_capture");
    assert.equal(outcome.result.normalized_signal.source_system, "fi_os");
  });

  it("hairaudit representative input keeps forensic_audit contract mapping", async () => {
    const outcome = await classifyUnifiedImageRequest({
      source_system: "hairaudit",
      ...BASE_REQUEST,
      canonical_photo_category: "patient_current_front",
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.result.classification.capture_source, "forensic_audit");
    assert.equal(outcome.result.normalized_signal.source_system, "hairaudit");
  });
});