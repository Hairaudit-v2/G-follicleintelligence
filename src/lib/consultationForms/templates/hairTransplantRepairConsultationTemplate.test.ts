import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hairTransplantRepairConsultationSchemaV1 } from "./hairTransplantRepairConsultationTemplate";

function allFieldIds(schema: { sections: { fields: { id: string; type: string }[] }[] }): { id: string; type: string }[] {
  return schema.sections.flatMap((s) => s.fields.map((f) => ({ id: f.id, type: f.type })));
}

describe("hairTransplantRepairConsultationTemplate", () => {
  it("has exactly five sections for pathway 4", () => {
    assert.equal(hairTransplantRepairConsultationSchemaV1.sections.length, 5);
    const ids = hairTransplantRepairConsultationSchemaV1.sections.map((s) => s.id);
    assert.deepEqual(ids, [
      "rapid_intake",
      "previous_surgery_history",
      "repair_assessment",
      "corrective_recommendation",
      "clinical_summary_handoff",
    ]);
  });

  it("does not include quote_builder or graft quote style fields", () => {
    const fields = allFieldIds(hairTransplantRepairConsultationSchemaV1);
    const ids = fields.map((f) => f.id);
    assert.ok(!ids.some((id) => id.includes("quote")));
    assert.ok(!fields.some((f) => f.type === "quote_builder"));
    assert.ok(!ids.includes("estimated_grafts_min"));
    assert.ok(!ids.includes("estimated_grafts_max"));
  });
});
