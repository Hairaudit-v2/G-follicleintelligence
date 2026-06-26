import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGoogleCalendarPlatformProgressModule,
  GOOGLE_CALENDAR_INTEGRATION_PROGRESS,
} from "./googleCalendarIntegrationProgress";

describe("googleCalendarIntegrationProgress", () => {
  it("buildGoogleCalendarPlatformProgressModule mirrors canonical tracker", () => {
    const mod = buildGoogleCalendarPlatformProgressModule();
    assert.equal(mod.id, "google-calendar-integration");
    assert.equal(mod.name, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.name);
    assert.equal(mod.completionPercent, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.progressPercent);
    assert.equal(mod.status, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.status);
    assert.equal(mod.stage, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.platformStage);
    assert.equal(mod.description, GOOGLE_CALENDAR_INTEGRATION_PROGRESS.platformDescription);
  });

  it("tracks Operational beta at 82% with GC-CSP in completed scope", () => {
    assert.equal(GOOGLE_CALENDAR_INTEGRATION_PROGRESS.status, "Operational beta");
    assert.equal(GOOGLE_CALENDAR_INTEGRATION_PROGRESS.progressPercent, 82);
    assert.ok(
      GOOGLE_CALENDAR_INTEGRATION_PROGRESS.completed.some((item) => item.includes("GC-CSP"))
    );
  });
});
