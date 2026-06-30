import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizePatternClassificationString,
  parseRepairVisualAnnotations,
  parseSelectedZones,
} from "./consultationVisualAssessmentModel";

describe("consultationVisualAssessmentModel", () => {
  it("normalizePatternClassificationString trims and drops non-strings", () => {
    assert.equal(normalizePatternClassificationString("  nw3  "), "nw3");
    assert.equal(normalizePatternClassificationString(null), "");
    assert.equal(normalizePatternClassificationString(42), "");
    assert.equal(normalizePatternClassificationString({}), "");
  });

  it("parseSelectedZones filters unknown ids and dedupes", () => {
    assert.deepEqual(parseSelectedZones(["frontal", "bogus", "frontal", "crown"]), [
      "frontal",
      "crown",
    ]);
  });

  it("parseSelectedZones returns [] for non-array non-json inputs", () => {
    assert.deepEqual(parseSelectedZones(null), []);
    assert.deepEqual(parseSelectedZones({}), []);
    assert.deepEqual(parseSelectedZones("not-json"), []);
  });

  it("parseSelectedZones accepts JSON string arrays", () => {
    assert.deepEqual(parseSelectedZones('["frontal","crown"]'), ["frontal", "crown"]);
  });

  it("parseSelectedZones rejects oversized JSON strings", () => {
    assert.deepEqual(parseSelectedZones("[" + "1".repeat(70_000) + "]"), []);
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

  it("parseRepairVisualAnnotations returns {} for invalid shapes", () => {
    assert.deepEqual(parseRepairVisualAnnotations(null), {});
    assert.deepEqual(parseRepairVisualAnnotations([]), {});
    assert.deepEqual(parseRepairVisualAnnotations("not-json"), {});
    assert.deepEqual(parseRepairVisualAnnotations('["array","root"]'), {});
  });

  it("parseRepairVisualAnnotations accepts JSON object strings", () => {
    const s = JSON.stringify({ frontal: ["scarring"], crown: ["bad_tag", "poor_density"] });
    const out = parseRepairVisualAnnotations(s);
    assert.deepEqual(out.frontal, ["scarring"]);
    assert.deepEqual(out.crown, ["poor_density"]);
  });

  it("parseRepairVisualAnnotations rejects oversized JSON strings", () => {
    assert.deepEqual(parseRepairVisualAnnotations("z".repeat(70_000)), {});
  });
});
