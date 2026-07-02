import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPatientJourneyTransitionAllowed } from "@/src/lib/patientJourney/patientJourneyStateCore";
import { mergeProcedureDayMetrics } from "./procedureDayWorkflowCore";

describe("procedureDayCompletion", () => {
  it("allows journey transition to procedure_completed from procedure_day", () => {
    assert.equal(
      isPatientJourneyTransitionAllowed("procedure_day", "procedure_completed", false),
      true
    );
  });

  it("mergeProcedureDayMetrics preserves existing surgical metrics", () => {
    const merged = mergeProcedureDayMetrics(
      { graftsExtracted: 100, notes: "baseline" },
      { graftsImplanted: 95, notes: "updated" }
    );
    assert.equal(merged.graftsExtracted, 100);
    assert.equal(merged.graftsImplanted, 95);
    assert.equal(merged.notes, "updated");
  });

  it("post-op summary shape is stored in session metadata contract", () => {
    const metadata = mergeProcedureDayMetrics({}, { post_op_summary: "Handoff complete." });
    assert.equal(metadata.post_op_summary, "Handoff complete.");
  });
});