import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildConsultationHubLayoutPlan,
  consultationHubSectionIndex,
} from "@/src/lib/consultations/consultationHubLayoutPlan";

describe("buildConsultationHubLayoutPlan", () => {
  it("without completion summary: launcher first, no routing, no intelligence in plan", () => {
    const plan = buildConsultationHubLayoutPlan(false);
    assert.equal(plan.showRoutingTiles, false);
    assert.equal(plan.showIntelligenceSummary, false);
    assert.deepEqual(plan.orderedSections, ["pathway_launcher", "trichoscopy", "intake"]);
    assert.equal(plan.orderedSections[0], "pathway_launcher");
    assert.ok(!plan.orderedSections.includes("routing"));
    assert.ok(!plan.orderedSections.includes("intelligence_summary"));
    assert.ok(plan.orderedSections.includes("trichoscopy"));
  });

  it("with completion summary: intelligence then routing then trichoscopy then launcher then intake", () => {
    const plan = buildConsultationHubLayoutPlan(true);
    assert.equal(plan.showRoutingTiles, true);
    assert.equal(plan.showIntelligenceSummary, true);
    assert.deepEqual(plan.orderedSections, [
      "intelligence_summary",
      "routing",
      "trichoscopy",
      "pathway_launcher",
      "intake",
    ]);
    assert.equal(plan.orderedSections[0], "intelligence_summary");
    const iIntel = consultationHubSectionIndex(plan, "intelligence_summary");
    const iRoute = consultationHubSectionIndex(plan, "routing");
    const iTricho = consultationHubSectionIndex(plan, "trichoscopy");
    const iLaunch = consultationHubSectionIndex(plan, "pathway_launcher");
    assert.ok(iIntel >= 0 && iRoute >= 0 && iTricho >= 0 && iLaunch >= 0);
    assert.ok(iIntel < iRoute, "intelligence summary before routing");
    assert.ok(iRoute < iTricho, "routing before trichoscopy");
    assert.ok(iTricho < iLaunch, "trichoscopy before pathway launcher");
    assert.ok(iLaunch < consultationHubSectionIndex(plan, "intake"), "launcher before intake");
  });
});
