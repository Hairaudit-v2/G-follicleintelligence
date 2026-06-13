import test from "node:test";
import assert from "node:assert/strict";
import { parseConsultationChecklistModelJson } from "./modelChecklistJsonParse";

test("parseConsultationChecklistModelJson accepts valid payload", () => {
  const r = parseConsultationChecklistModelJson({
    confidence_score: 0.87,
    priority_level: "high",
    medication_discussion_required: true,
    stabilisation_discussion_required: true,
    donor_preservation_discussion_required: true,
    expectation_management_required: true,
    consent_complexity_level: "high",
    documentation_required: true,
    follow_up_required: true,
    delay_recommended: true,
    checklist_items: ["Discuss stabilization options"],
    risk_flags: ["Rapid progression detected"],
    consultation_summary: "Summary",
    ai_notes: "Notes",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.priority_level, "high");
  assert.equal(r.data.checklist_items[0], "Discuss stabilization options");
});

test("parseConsultationChecklistModelJson rejects invalid shape", () => {
  const r = parseConsultationChecklistModelJson({ foo: 1 });
  assert.equal(r.ok, false);
});
