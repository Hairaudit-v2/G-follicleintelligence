import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PATIENT_GATEWAY_IMAGE_SLOTS,
  isPatientGatewayImageSlot,
  mapPatientGatewayImageSlot,
  parsePatientGatewayImageSlot,
} from "./patientGatewayImageSlots";
import { PATIENT_PORTAL_IMAGE_SLOT_OPTIONS } from "./patientPortalImageUploadCore";

describe("patientGatewayImageSlots", () => {
  it("exposes a stable patient-facing vocabulary", () => {
    assert.deepEqual(
      PATIENT_GATEWAY_IMAGE_SLOTS.map((s) => s.slot),
      ["front_hairline", "top_crown", "donor_area"]
    );
  });

  it("rejects legacy/internal category names as slots", () => {
    assert.equal(isPatientGatewayImageSlot("progress"), false);
    assert.equal(isPatientGatewayImageSlot("fu_front"), false);
    assert.equal(parsePatientGatewayImageSlot("consult"), null);
  });

  it("maps each slot deterministically onto FiOS pathway fields", () => {
    const portalSlugs = new Set(PATIENT_PORTAL_IMAGE_SLOT_OPTIONS.map((o) => o.slug));
    for (const def of PATIENT_GATEWAY_IMAGE_SLOTS) {
      const mapped = mapPatientGatewayImageSlot(def.slot);
      assert.equal(mapped.slot, def.slot);
      assert.equal(mapped.protocolSlotSlug, def.protocolSlotSlug);
      assert.ok(portalSlugs.has(mapped.protocolSlotSlug));
      assert.equal(mapped.captureSource, "patient_portal");
      assert.equal(mapped.imageCategory, "progress");
      assert.equal(mapped.protocolTemplateSlug, "follow_up_review");
      // Stable across calls
      assert.deepEqual(mapPatientGatewayImageSlot(def.slot), mapped);
    }
  });
});
