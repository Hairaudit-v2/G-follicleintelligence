/**
 * FI-WEB-REFRESH-1J — platform progress registry counts and Patient App presence.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getModulesByStatuses,
  getOperationalOrPilotSummary,
  getPlatformProgressMetrics,
  getPlatformProgressSnapshot,
  getPlatformStatusDistributionBars,
  PLATFORM_PROGRESS_MODULES,
  PLATFORM_PROGRESS_PAGE_CONTENT,
  PLATFORM_PROGRESS_VERIFIED_MILESTONES,
} from "@/lib/marketing/platformProgressPageContent";

describe("FI-WEB-REFRESH-1J platform progress Patient App registry", () => {
  it("tracks 22 systems with derived Operational Pilot counts", () => {
    const snapshot = getPlatformProgressSnapshot();
    assert.equal(snapshot.activeModuleCount, 22);
    assert.equal(snapshot.statusCounts.Deployed, 3);
    assert.equal(snapshot.statusCounts["Operational Pilot"], 12);
    assert.equal(snapshot.statusCounts["Advanced Build"], 6);
    assert.equal(snapshot.statusCounts["In Development"], 0);
    assert.equal(snapshot.statusCounts["Research and Future Development"], 1);
    assert.equal(snapshot.deployableSurfaceCount, 15);
    assert.equal(snapshot.lastUpdated, "2026-08-04");
  });

  it("includes FI Patient App as Operational Pilot after PatientOS", () => {
    const patientOsIndex = PLATFORM_PROGRESS_MODULES.findIndex((m) => m.id === "patient-os");
    const patientAppIndex = PLATFORM_PROGRESS_MODULES.findIndex((m) => m.id === "patient-app");
    assert.ok(patientOsIndex >= 0);
    assert.ok(patientAppIndex > patientOsIndex);

    const patientApp = PLATFORM_PROGRESS_MODULES[patientAppIndex];
    assert.equal(patientApp?.name, "FI Patient App");
    assert.equal(patientApp?.status, "Operational Pilot");
    assert.match(patientApp?.latestMilestone ?? "", /Phase 1 Journey Control/i);
    assert.equal(patientApp?.learnMoreHref, "/platform/patient-app");

    const operational = getModulesByStatuses(["Deployed", "Operational Pilot"]);
    const names = operational.map((m) => m.name);
    assert.ok(names.includes("FI Patient App"));
    assert.ok(names.indexOf("FI Patient App") > names.indexOf("PatientOS"));
  });

  it("keeps PatientOS and Patient App distinct in public copy", () => {
    const distinction = PLATFORM_PROGRESS_PAGE_CONTENT.patientAppUsability.distinction;
    assert.match(distinction.patientOs, /clinic-facing longitudinal patient record/i);
    assert.match(distinction.patientApp, /patient-facing mobile surface/i);
    assert.doesNotMatch(distinction.patientApp, /PatientOS App|Patient Portal|Journey App/i);
  });

  it("derives status-distribution bars from counts, not completion percentages", () => {
    const bars = getPlatformStatusDistributionBars();
    assert.equal(bars.length, 5);
    const pilot = bars.find((b) => b.status === "Operational Pilot");
    assert.ok(pilot);
    assert.equal(pilot.count, 12);
    assert.equal(pilot.total, 22);
    assert.equal(pilot.widthFraction, 12 / 22);
    assert.equal(pilot.accessibleValue, "12 of 22 systems are in Operational Pilot.");
    assert.doesNotMatch(pilot.accessibleValue, /% complete|platform completion/i);

    const metrics = getPlatformProgressMetrics();
    assert.equal(metrics.find((m) => m.label === "Systems tracked")?.value, "22");
    assert.equal(
      getOperationalOrPilotSummary(),
      "15 of 22 systems are deployed or operating in controlled pilot scope."
    );
  });

  it("features FinancialOS trial readiness as the newest verified milestone", () => {
    assert.equal(PLATFORM_PROGRESS_VERIFIED_MILESTONES[0]?.id, "financial-os-trial-ready");
    assert.equal(PLATFORM_PROGRESS_VERIFIED_MILESTONES[0]?.date, "2026-08-04");
    assert.ok(
      PLATFORM_PROGRESS_VERIFIED_MILESTONES.some((m) => m.id === "clinic-inbox-staged-approvals")
    );
    assert.ok(
      PLATFORM_PROGRESS_VERIFIED_MILESTONES.some((m) => m.id === "typed-clinical-notes")
    );
    assert.ok(
      PLATFORM_PROGRESS_VERIFIED_MILESTONES.some((m) => m.id === "controlled-crm-migration")
    );
    assert.equal(PLATFORM_PROGRESS_PAGE_CONTENT.hero.lastUpdated, "2026-08-04");
  });

  it("lists FinancialOS as Operational Pilot with trial payment notes", () => {
    const financial = PLATFORM_PROGRESS_MODULES.find((m) => m.id === "financial-os");
    assert.equal(financial?.status, "Operational Pilot");
    assert.match(financial?.latestMilestone ?? "", /manual payments/i);
    assert.match(financial?.latestMilestone ?? "", /Live payments/i);
    assert.match(financial?.description ?? "", /manual payment/i);
  });

  it("updates LeadFlow and PatientOS latest milestones for Aug 2026 operator surfaces", () => {
    const leadflow = PLATFORM_PROGRESS_MODULES.find((m) => m.id === "leadflow");
    const patientOs = PLATFORM_PROGRESS_MODULES.find((m) => m.id === "patient-os");
    assert.match(leadflow?.latestMilestone ?? "", /Inbox/i);
    assert.match(patientOs?.latestMilestone ?? "", /Typed clinical notes/i);
  });
});
