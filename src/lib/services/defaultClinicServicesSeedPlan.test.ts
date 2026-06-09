import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDefaultClinicServicesSeedPlan } from "./defaultClinicServicesSeedPlan";

describe("buildDefaultClinicServicesSeedPlan", () => {
  it("creates all rows on empty tenant catalog", () => {
    const { summary } = buildDefaultClinicServicesSeedPlan([]);
    assert.equal(summary.created, 17);
    assert.equal(summary.updated, 0);
  });

  it("updates existing matches without creating duplicates", () => {
    const { summary } = buildDefaultClinicServicesSeedPlan([
      { id: "a1", name: "PRP Treatment", category: "Treatment", booking_type: "prp" },
      { id: "a2", name: "Phone Consultation", category: "Consultation", booking_type: null },
    ]);
    assert.equal(summary.created, 15);
    assert.equal(summary.updated, 2);
  });

  it("matches typed rows by booking_type even when name differs", () => {
    const { plan } = buildDefaultClinicServicesSeedPlan([
      { id: "x", name: "Custom PRP label", category: "Treatment", booking_type: "prp" },
    ]);
    const prp = plan.entries.find((e) => e.approved.booking_type === "prp");
    assert.equal(prp?.action, "update");
    assert.equal(prp?.existingId, "x");
  });
});
