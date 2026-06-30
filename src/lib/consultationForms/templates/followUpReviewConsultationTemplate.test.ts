import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { followUpReviewConsultationSchemaV1 } from "./followUpReviewConsultationTemplate";
import { evaluateConsultationFormCondition } from "../consultationFormCondition";

function allFields(schema: {
  sections: { fields: { id: string; type: string; showWhen?: unknown }[] }[];
}): {
  id: string;
  type: string;
  showWhen?: unknown;
}[] {
  return schema.sections.flatMap((s) =>
    s.fields.map((f) => ({ id: f.id, type: f.type, showWhen: f.showWhen }))
  );
}

describe("followUpReviewConsultationTemplate", () => {
  it("has exactly four sections", () => {
    assert.equal(followUpReviewConsultationSchemaV1.sections.length, 4);
  });

  it("excludes quote, graft, donor, and surgery-planning field ids", () => {
    const fields = allFields(followUpReviewConsultationSchemaV1);
    const ids = fields.map((f) => f.id);
    const joined = ids.join(" ");
    assert.ok(!joined.includes("quote"));
    assert.ok(!fields.some((f) => f.type === "quote_builder"));
    assert.ok(!ids.some((id) => id.includes("donor")));
    assert.ok(!ids.some((id) => id.includes("graft")));
    assert.ok(!ids.includes("surgical_suitability"));
  });

  it("shows side_effects_notes only when side_effects_present is true", () => {
    const sec = followUpReviewConsultationSchemaV1.sections.find(
      (s) => s.id === "progress_assessment"
    );
    const notes = sec?.fields.find((f) => f.id === "side_effects_notes");
    assert.ok(notes?.showWhen);
    assert.equal(
      evaluateConsultationFormCondition(notes!.showWhen, { side_effects_present: false }),
      false
    );
    assert.equal(
      evaluateConsultationFormCondition(notes!.showWhen, { side_effects_present: true }),
      true
    );
  });
});
