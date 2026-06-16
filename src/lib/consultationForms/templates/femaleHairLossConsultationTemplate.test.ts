import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FEMALE_HAIR_LOSS_LUDWIG_TRIGGER_PATTERNS,
  FEMALE_HAIR_LOSS_SINCLAIR_TRIGGER_PATTERNS,
  femaleHairLossConsultationSchemaV1,
} from "./femaleHairLossConsultationTemplate";

function allFieldIds(schema: typeof femaleHairLossConsultationSchemaV1): string[] {
  return schema.sections.flatMap((s) => s.fields.map((f) => f.id));
}

function findField(schema: typeof femaleHairLossConsultationSchemaV1, id: string) {
  for (const sec of schema.sections) {
    const f = sec.fields.find((x) => x.id === id);
    if (f) return f;
  }
  return undefined;
}

describe("femaleHairLossConsultationSchemaV1", () => {
  it("has exactly five sections", () => {
    assert.equal(femaleHairLossConsultationSchemaV1.sections.length, 5);
  });

  it("does not define surgery, donor, graft, or quote-builder fields", () => {
    const joined = allFieldIds(femaleHairLossConsultationSchemaV1).join(" ");
    const banned = ["donor", "graft", "quote_builder", "quote", "surgical_suitability", "body_area_map"];
    for (const b of banned) {
      assert.equal(joined.includes(b), false, `unexpected token ${b}`);
    }
    for (const f of femaleHairLossConsultationSchemaV1.sections.flatMap((s) => s.fields)) {
      assert.notEqual(f.type, "quote_builder");
      assert.notEqual(f.type, "body_area_map");
    }
  });

  it("shows Ludwig when female pattern suggests female-pattern density grading", () => {
    const f = findField(femaleHairLossConsultationSchemaV1, "ludwig_classification");
    assert.ok(f?.showWhen);
    assert.equal(f.showWhen?.fieldId, "female_pattern_type");
    assert.equal(f.showWhen?.operator, "in");
    assert.deepEqual(f.showWhen?.value, [...FEMALE_HAIR_LOSS_LUDWIG_TRIGGER_PATTERNS]);
    assert.ok(f.showWhen?.value.includes("part_widening"));
  });

  it("shows Sinclair for diffuse and part widening only", () => {
    const f = findField(femaleHairLossConsultationSchemaV1, "sinclair_classification");
    assert.ok(f?.showWhen);
    assert.deepEqual(f.showWhen?.value, [...FEMALE_HAIR_LOSS_SINCLAIR_TRIGGER_PATTERNS]);
  });

  it("pathology_reason is required only when pathology_recommended_explicit is true", () => {
    const f = findField(femaleHairLossConsultationSchemaV1, "pathology_reason");
    assert.equal(f?.required, true);
    assert.equal(f?.showWhen?.fieldId, "pathology_recommended_explicit");
    assert.equal(f?.showWhen?.operator, "equals");
    assert.equal(f?.showWhen?.value, true);
  });
});
