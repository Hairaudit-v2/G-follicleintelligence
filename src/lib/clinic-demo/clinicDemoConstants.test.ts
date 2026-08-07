import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CLINIC_DEMO_PACK_CODE,
  CLINIC_DEMO_TENANT_SLUG,
  isClinicDemoTenantMetadata,
} from "./clinicDemoConstants";

describe("clinicDemoConstants", () => {
  it("uses follicle-demo-clinic slug and enterprise_demo pack", () => {
    assert.equal(CLINIC_DEMO_TENANT_SLUG, "follicle-demo-clinic");
    assert.equal(CLINIC_DEMO_PACK_CODE, "enterprise_demo");
  });

  it("detects clinic demo metadata", () => {
    assert.equal(isClinicDemoTenantMetadata({ clinic_demo_mode: true }), true);
    assert.equal(isClinicDemoTenantMetadata({ demo_package: "B" }), true);
    assert.equal(isClinicDemoTenantMetadata({ enterprise_demo_mode: true }), false);
  });
});
