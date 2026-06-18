import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  finalizePilotValidationReport,
  type ReceptionOsPilotValidationCheck,
} from "@/src/lib/receptionOs/receptionOsPilotValidationModel";

describe("receptionOsPilotValidationModel", () => {
  it("computes summary counts and readyForPilot", () => {
    const checks: ReceptionOsPilotValidationCheck[] = [
      { id: "a", label: "A", severity: "pass", detail: "ok" },
      { id: "b", label: "B", severity: "warn", detail: "warn" },
    ];
    const report = finalizePilotValidationReport({
      tenantId: "11111111-1111-4111-8111-111111111111",
      validatedAt: "2026-06-19T10:00:00.000Z",
      operatingDate: "2026-06-19",
      checks,
    });
    assert.equal(report.summary.pass, 1);
    assert.equal(report.summary.warn, 1);
    assert.equal(report.summary.fail, 0);
    assert.equal(report.readyForPilot, true);
  });

  it("readyForPilot is false when any check fails", () => {
    const report = finalizePilotValidationReport({
      tenantId: "11111111-1111-4111-8111-111111111111",
      validatedAt: "2026-06-19T10:00:00.000Z",
      operatingDate: "2026-06-19",
      checks: [{ id: "x", label: "X", severity: "fail", detail: "bad" }],
    });
    assert.equal(report.readyForPilot, false);
  });
});
