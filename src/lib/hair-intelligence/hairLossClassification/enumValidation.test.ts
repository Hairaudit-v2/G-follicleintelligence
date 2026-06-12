import test from "node:test";
import assert from "node:assert/strict";
import {
  clampHairLossConfidence,
  clampHairLossSeverityScore,
  normalizeClassificationGradeForSystem,
  normalizeHieHairLossClassificationSystem,
  normalizeHieHairLossPatternType,
} from "./enumValidation";

test("normalizeClassificationGradeForSystem norwood accepts III Vertex", () => {
  assert.equal(normalizeClassificationGradeForSystem("norwood", "iii vertex"), "III Vertex");
});

test("normalizeClassificationGradeForSystem norwood uppercases roman", () => {
  assert.equal(normalizeClassificationGradeForSystem("norwood", "v"), "V");
});

test("normalizeClassificationGradeForSystem olsen lowercases", () => {
  assert.equal(normalizeClassificationGradeForSystem("olsen", "Mild"), "mild");
});

test("clampHairLossConfidence", () => {
  assert.equal(clampHairLossConfidence(1.5), 1);
  assert.equal(clampHairLossConfidence(-1), 0);
  assert.equal(clampHairLossConfidence("x"), 0);
});

test("clampHairLossSeverityScore", () => {
  assert.equal(clampHairLossSeverityScore(8.4), 8);
  assert.equal(clampHairLossSeverityScore(11), null);
  assert.equal(clampHairLossSeverityScore(null), null);
});

test("normalize enums", () => {
  assert.equal(normalizeHieHairLossClassificationSystem("not_real"), "custom");
  assert.equal(normalizeHieHairLossPatternType("male_pattern_baldness"), "male_pattern_baldness");
  assert.equal(normalizeHieHairLossPatternType("nope"), "unknown");
});
