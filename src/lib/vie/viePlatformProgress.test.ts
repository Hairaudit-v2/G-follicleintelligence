import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildViePlatformProgressModule, VIE_PLATFORM_PHASES, VIE_PLATFORM_PROGRESS } from "./viePlatformProgress";

describe("viePlatformProgress", () => {
  it("buildViePlatformProgressModule mirrors canonical tracker", () => {
    const mod = buildViePlatformProgressModule();
    assert.equal(mod.id, "visual-intelligence-engine");
    assert.equal(mod.name, VIE_PLATFORM_PROGRESS.name);
    assert.equal(mod.completionPercent, VIE_PLATFORM_PROGRESS.progressPercent);
    assert.equal(mod.status, VIE_PLATFORM_PROGRESS.status);
    assert.equal(mod.stage, VIE_PLATFORM_PROGRESS.platformStage);
    assert.equal(mod.description, VIE_PLATFORM_PROGRESS.platformDescription);
  });

  it("tracks 67% with VIE-1 through VIE-5 completed", () => {
    assert.equal(VIE_PLATFORM_PROGRESS.progressPercent, 67);
    assert.equal(VIE_PLATFORM_PROGRESS.completedPhases.length, 5);
    assert.equal(VIE_PLATFORM_PROGRESS.pendingPhases.length, 5);
    assert.ok(VIE_PLATFORM_PROGRESS.completedPhases.some((p) => p.startsWith("VIE-5")));
    assert.ok(VIE_PLATFORM_PROGRESS.pendingPhases.some((p) => p.startsWith("VIE-6")));
    assert.equal(VIE_PLATFORM_PHASES.filter((p) => p.status === "completed").length, 5);
    assert.equal(VIE_PLATFORM_PHASES.filter((p) => p.status === "pending").length, 5);
  });
});
