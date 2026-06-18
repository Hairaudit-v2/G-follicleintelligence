import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertReceptionTaskStatusTransition,
  canTransitionReceptionTaskStatus,
  mapAlertKindToSourceType,
  receptionTaskActionAllowed,
} from "@/src/lib/receptionOs/receptionTaskPolicy";

describe("receptionTaskPolicy", () => {
  it("allows valid status transitions", () => {
    assert.equal(canTransitionReceptionTaskStatus("open", "in_progress"), true);
    assert.equal(canTransitionReceptionTaskStatus("in_progress", "resolved"), true);
    assert.equal(canTransitionReceptionTaskStatus("resolved", "open"), false);
    assert.doesNotThrow(() => assertReceptionTaskStatusTransition("open", "snoozed"));
    assert.throws(() => assertReceptionTaskStatusTransition("resolved", "open"));
  });

  it("maps alert kinds to source types", () => {
    assert.equal(mapAlertKindToSourceType("missing_deposit"), "payment");
    assert.equal(mapAlertKindToSourceType("surgery_risk"), "surgery");
    assert.equal(mapAlertKindToSourceType("unknown"), "system");
  });

  it("gates actions by reception role", () => {
    assert.equal(receptionTaskActionAllowed("receptionist", "assign"), true);
    assert.equal(receptionTaskActionAllowed("receptionist", "dismiss"), false);
    assert.equal(receptionTaskActionAllowed("admin", "dismiss"), true);
    assert.equal(receptionTaskActionAllowed("consultant", "create_from_alert"), true);
  });
});
