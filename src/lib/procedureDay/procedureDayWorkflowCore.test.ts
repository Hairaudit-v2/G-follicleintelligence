import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyGraftMetricIncrement,
  assertProcedureDayStageTransitionAllowed,
  buildProcedureDayChecklist,
  buildProcedureDaySafetyWarnings,
  deriveProcedureDayStageFromBooking,
  nextProcedureDayStage,
  PROCEDURE_DAY_WORKFLOW_STAGES,
} from "./procedureDayWorkflowCore";

describe("procedureDayWorkflowCore", () => {
  it("defines eleven workflow stages in order", () => {
    assert.equal(PROCEDURE_DAY_WORKFLOW_STAGES.length, 11);
    assert.equal(PROCEDURE_DAY_WORKFLOW_STAGES[0], "scheduled");
    assert.equal(PROCEDURE_DAY_WORKFLOW_STAGES.at(-1), "completed");
  });

  it("derives stage from booking without session row", () => {
    assert.equal(
      deriveProcedureDayStageFromBooking({ bookingStatus: "scheduled" }),
      "scheduled"
    );
    assert.equal(
      deriveProcedureDayStageFromBooking({ bookingStatus: "arrived" }),
      "arrived"
    );
    assert.equal(
      deriveProcedureDayStageFromBooking({
        bookingStatus: "arrived",
        procedureStatus: "in_progress",
      }),
      "extraction"
    );
  });

  it("allows single-step forward transitions only", () => {
    assert.doesNotThrow(() =>
      assertProcedureDayStageTransitionAllowed("scheduled", "arrived")
    );
    assert.throws(() =>
      assertProcedureDayStageTransitionAllowed("scheduled", "extraction")
    );
    assert.throws(() =>
      assertProcedureDayStageTransitionAllowed("implantation", "extraction")
    );
  });

  it("nextProcedureDayStage walks the pipeline", () => {
    assert.equal(nextProcedureDayStage("scheduled"), "arrived");
    assert.equal(nextProcedureDayStage("quality_check"), "post_op");
    assert.equal(nextProcedureDayStage("completed"), null);
  });

  it("applyGraftMetricIncrement accumulates from zero baseline", () => {
    assert.equal(applyGraftMetricIncrement(null, 10), 10);
    assert.equal(applyGraftMetricIncrement(40, 10), 50);
  });

  it("buildProcedureDaySafetyWarnings flags graft imbalance", () => {
    const warnings = buildProcedureDaySafetyWarnings({
      stage: "implantation",
      graftsExtracted: 100,
      graftsImplanted: 120,
    });
    assert.ok(warnings.some((w) => w.includes("exceeds extracted")));
  });

  it("buildProcedureDayChecklist marks consent from signals", () => {
    const items = buildProcedureDayChecklist("pre_op", {
      consentSigned: true,
      preOpComplete: false,
    });
    const consent = items.find((i) => i.id === "consent");
    assert.equal(consent?.complete, true);
  });
});