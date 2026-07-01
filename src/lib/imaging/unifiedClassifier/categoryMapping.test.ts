import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  mapExternalLabelToPhotoCategoryV1,
  mapHliCategoryToPhotoCategoryV1,
} from "./categoryMapping";

describe("PhotoCategoryV1 alias mapping", () => {
  it("maps left_profile to left_temple", () => {
    assert.equal(mapHliCategoryToPhotoCategoryV1("left_profile").category, "left_temple");
  });

  it("maps right_profile to right_temple", () => {
    assert.equal(mapHliCategoryToPhotoCategoryV1("right_profile").category, "right_temple");
  });

  it("maps top to wet_hair_top", () => {
    assert.equal(mapHliCategoryToPhotoCategoryV1("top").category, "wet_hair_top");
  });

  it("maps HairAudit hairline alias to hairline_closeup", () => {
    assert.equal(mapExternalLabelToPhotoCategoryV1("preop_hairline").category, "hairline_closeup");
  });

  it("maps trichoscopy alias to microscopic", () => {
    assert.equal(mapExternalLabelToPhotoCategoryV1("trichoscopy").category, "microscopic");
  });
});
