import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGoogleCalendarPlatformProgressModule,
  GOOGLE_CALENDAR_INTEGRATION_PROGRESS,
} from "./googleCalendarIntegrationProgress";

describe("googleCalendarIntegrationProgress", () => {
  it("buildGoogleCalendarPlatformProgressModule mirrors canonical tracker", () => {
    const mod = buildGoogleCalendarPlatformProgressModule();
    assert.equal(mod.id, "calendar-os");
    assert.equal(mod.name, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.name);
    assert.equal(mod.completionPercent, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.progressPercent);
    assert.equal(mod.status, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.status);
    assert.equal(mod.statusLabel, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.statusLabel);
    assert.equal(mod.stage, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.platformStage);
    assert.equal(mod.description, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.platformDescription);
    assert.equal(mod.latestMilestone, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.latestMilestone);
  });

  it("tracks Operational beta at 90% with GC-11 in completed scope", () => {
    assert.equal(GOOGLE_CALENDAR_INTEGRATION_PROGRESS.status, "Operational beta");
    assert.equal(GOOGLE_CALENDAR_INTEGRATION_PROGRESS.progressPercent, 90);
    assert.ok(
      GOOGLE_CALENDAR_INTEGRATION_PROGRESS.completed.some((item) => item.includes("GC-11"))
    );
  });
});
