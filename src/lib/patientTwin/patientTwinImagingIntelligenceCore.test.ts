import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPatientTwinImagingDeepLinks } from "./patientTwinImagingIntelligenceCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "22222222-2222-4222-8222-222222222222";
const IMAGE = "33333333-3333-4333-8333-333333333333";
const HAIRAUDIT_CASE = "66666666-6666-4666-8666-666666666666";

describe("patientTwinImagingIntelligenceCore HairAudit deep links", () => {
  it("resolves HairAudit admin link from dual-write source_case_id metadata", () => {
    const links = buildPatientTwinImagingDeepLinks({
      tenantId: TENANT,
      patientId: PATIENT,
      metadata: {
        source_system: "hairaudit",
        source_case_id: HAIRAUDIT_CASE,
        upload_source: "hairaudit",
      },
      imageId: IMAGE,
      reviewRequired: false,
    });
    assert.ok(links.links.some((l) => l.href === "/hair-audit/admin"));
  });
});
