import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseRepairVisualAnnotations,
  parseSelectedZones,
} from "./consultationVisualAssessmentModel";

describe("consultationVisualAssessmentModel", () => {
  it("parseSelectedZones filters unknown ids and dedupes", () => {
    assert.deepEqual(parseSelectedZones(["frontal", "bogus", "frontal", "crown"]), ["frontal", "crown"]);
  });

  it("parseRepairVisualAnnotations normalises tags per zone", () => {
    const raw = {
      frontal: ["failed_growth", "nope", "failed_growth"],
      crown: ["overharvested"],
      bogus: ["failed_growth"],
    };
    const out = parseRepairVisualAnnotations(raw);
    assert.deepEqual(out.frontal, ["failed_growth"]);
    assert.deepEqual(out.crown, ["overharvested"]);
    assert.equal("bogus" in out, false);
  });
});
