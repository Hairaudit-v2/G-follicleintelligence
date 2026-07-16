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
    assert.equal(mod.description, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.platformDescription);
    assert.equal(mod.latestMilestone, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.latestMilestone);
  });

  it("tracks Operational Pilot with GC-11 in completed scope", () => {
    assert.equal(GOOGLE_CALENDAR_INTEGRATION_PROGRESS.status, "Operational Pilot");
    assert.equal(GOOGLE_CALENDAR_INTEGRATION_PROGRESS.progressPercent, 90);
    assert.ok(
      GOOGLE_CALENDAR_INTEGRATION_PROGRESS.completed.some((item) => item.includes("GC-11"))
    );
  });
});
