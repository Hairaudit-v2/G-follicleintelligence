import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPatientClinicalPatchFromConsultationFormValues,
  mapConsultationLudwigToPatient,
  mapConsultationNorwoodToPatient,
  mapConsultationPatternTypeToHairline,
} from "./consultationScaleMapper";

describe("consultationScaleMapper", () => {
  it("maps consultation Norwood codes to patient scale values", () => {
    assert.equal(mapConsultationNorwoodToPatient("nw3"), "III");
    assert.equal(mapConsultationNorwoodToPatient("nw3v"), "IIIvertex");
    assert.equal(mapConsultationNorwoodToPatient("unsure"), "unknown");
    assert.equal(mapConsultationNorwoodToPatient("III"), "III");
  });

  it("maps consultation Ludwig codes to patient scale values", () => {
    assert.equal(mapConsultationLudwigToPatient("l2"), "II");
    assert.equal(mapConsultationLudwigToPatient("II"), "II");
  });

  it("maps pattern types to hairline_pattern", () => {
    assert.equal(mapConsultationPatternTypeToHairline("hairline"), "receding");
    assert.equal(mapConsultationPatternTypeToHairline("part_widening"), "diffuse");
  });

  it("builds patient patch from guided form values", () => {
    const patch = buildPatientClinicalPatchFromConsultationFormValues({
      pattern_type: "hairline",
      norwood_classification: "nw4",
      ludwig_classification: "",
      priority_focus: "regrowth_density",
    });
    assert.deepEqual(patch.fields, {
      norwood_scale: "IV",
      hairline_pattern: "receding",
      primary_concern: "regrowth_density",
    });
    assert.equal(patch.sinclairScale, null);
  });

  it("extracts Sinclair scale for metadata sync", () => {
    const patch = buildPatientClinicalPatchFromConsultationFormValues({
      female_pattern_type: "part_widening",
      sinclair_classification: "s3",
      ludwig_classification: "l2",
    });
    assert.equal(patch.sinclairScale, "s3");
    assert.equal(patch.fields.ludwig_scale, "II");
  });
});