import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyImageCategoryStub } from "@/src/lib/imaging-os/classification";
import { buildStubClassificationResponse } from "@/src/lib/hairaudit/fiOsHairAuditImageClassifyService";
import type { HairAuditImageClassifyRequest } from "@/src/lib/hairaudit/fiOsHairAuditImageClassifyService";

const SAMPLE_REQUEST: HairAuditImageClassifyRequest = {
  source_system: "hairaudit",
  idempotency_key: "idem-stub-parity-1",
  source_case_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  source_upload_id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
  canonical_photo_category: "patient_current_front",
  legacy_upload_type: "scalp_preop_front",
};

describe("imaging-core stub classification parity", () => {
  it("HairAudit stub response matches classifyImageCategoryStub mapping", () => {
    const stub = buildStubClassificationResponse(SAMPLE_REQUEST);
    const direct = classifyImageCategoryStub({
      external_category: SAMPLE_REQUEST.canonical_photo_category,
      legacy_upload_type: SAMPLE_REQUEST.legacy_upload_type,
      idempotency_key: SAMPLE_REQUEST.idempotency_key,
    });

    assert.equal(stub.canonical_photo_category, direct.canonical_photo_category);
    assert.equal(stub.confidence, direct.confidence);
    assert.equal(stub.protocol_status, "not_evaluated");
    assert.equal(stub.quality_status, "not_evaluated");
  });
});