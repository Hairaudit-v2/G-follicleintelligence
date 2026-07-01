import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FI_AI_IMAGE_CATEGORIES,
  mapCanonicalToPatientImageCategory,
  mapExternalToPatientImageCategory,
} from "./vocabulary";

describe("imaging-core vocabulary", () => {
  it("maps canonical categories to patient image library buckets", () => {
    assert.equal(mapCanonicalToPatientImageCategory("front"), "scalp");
    assert.equal(mapCanonicalToPatientImageCategory("donor"), "donor");
    assert.equal(mapCanonicalToPatientImageCategory("immediate_post_op"), "post_op");
    assert.equal(mapCanonicalToPatientImageCategory("microscopic"), "trichoscopy");
    assert.equal(mapCanonicalToPatientImageCategory("unknown"), "other");
  });

  it("maps HairAudit external labels through canonical hierarchy", () => {
    assert.equal(mapExternalToPatientImageCategory("frontal"), "scalp");
    assert.equal(mapExternalToPatientImageCategory("preop_donor_rear"), "donor");
    assert.equal(mapExternalToPatientImageCategory("patient_current_front"), "scalp");
  });

  it("maps HLI classifier categories via FI_AI_IMAGE_CATEGORIES", () => {
    for (const category of FI_AI_IMAGE_CATEGORIES) {
      const bucket = mapExternalToPatientImageCategory(category);
      assert.ok(bucket);
    }
    assert.equal(mapExternalToPatientImageCategory("left_profile"), "scalp");
    assert.equal(mapExternalToPatientImageCategory("graft_tray"), "post_op");
  });

  it("maps legacy patient_photo upload types through canonical hierarchy", () => {
    assert.equal(
      mapExternalToPatientImageCategory("unknown_label", "patient_photo:front"),
      "scalp"
    );
    assert.equal(
      mapExternalToPatientImageCategory("unknown_label", "patient_photo:donor"),
      "donor"
    );
  });
});