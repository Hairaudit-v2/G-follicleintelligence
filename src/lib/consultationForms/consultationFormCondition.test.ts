import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateConsultationFormCondition } from "./consultationFormCondition";

describe("evaluateConsultationFormCondition", () => {
  it("returns true when condition is undefined", () => {
    assert.equal(evaluateConsultationFormCondition(undefined, {}), true);
  });

  it("supports containsAny for multi-select arrays", () => {
    const values = { prior_treatments: ["minoxidil", "ht_prior"] };
    assert.equal(
      evaluateConsultationFormCondition(
        { fieldId: "prior_treatments", operator: "containsAny", value: ["ht_prior"] },
        values
      ),
      true
    );
    assert.equal(
      evaluateConsultationFormCondition(
        { fieldId: "prior_treatments", operator: "containsAny", value: ["prp"] },
        values
      ),
      false
    );
  });

  it("supports equals and isEmpty", () => {
    assert.equal(
      evaluateConsultationFormCondition({ fieldId: "x", operator: "equals", value: "a" }, { x: "a" }),
      true
    );
    assert.equal(evaluateConsultationFormCondition({ fieldId: "x", operator: "isEmpty" }, { x: "" }), true);
    assert.equal(evaluateConsultationFormCondition({ fieldId: "x", operator: "isNotEmpty" }, { x: "z" }), true);
  });

  it("supports in for single-value membership", () => {
    assert.equal(
      evaluateConsultationFormCondition(
        { fieldId: "primary_objective", operator: "in", value: ["ht_primary", "repair_revision"] },
        { primary_objective: "ht_primary" }
      ),
      true
    );
    assert.equal(
      evaluateConsultationFormCondition(
        { fieldId: "primary_objective", operator: "in", value: ["ht_primary", "repair_revision"] },
        { primary_objective: "medical_non_surgical" }
      ),
      false
    );
  });
});
