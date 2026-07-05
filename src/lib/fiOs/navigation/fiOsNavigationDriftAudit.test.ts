import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNavigationDriftReport,
  classifyNavigationDrift,
  collectFiOsCurrentNavigationModel,
  summarizeNavigationDrift,
} from "@/src/lib/fiOs/navigation/fiOsNavigationDriftAudit";
import { mapCurrentNavItemTo1BDomain } from "@/src/lib/fiOs/navigation/fiOsNavigationDriftAudit";

const TENANT = "tenant-audit-1";

test("collectFiOsCurrentNavigationModel includes primary, minimal, D6, and quick-create sources", () => {
  const items = collectFiOsCurrentNavigationModel(TENANT, { includeQuickCreate: true });
  assert.ok(items.some((i) => i.id === "dashboard" && i.source === "primary_sidebar"));
  assert.ok(items.some((i) => i.id === "calendar" && i.source === "primary_sidebar"));
  assert.ok(items.some((i) => i.id === "more" && i.source === "minimal_rail"));
  assert.ok(items.some((i) => i.id === "d6-presence" && i.source === "d6_intelligence"));
  assert.ok(items.some((i) => i.id.startsWith("quick-create-") && i.source === "quick_create"));
});

test("domain mapping examples from D6G scope", () => {
  const items = collectFiOsCurrentNavigationModel(TENANT, { includeQuickCreate: false });
  const byId = new Map(items.map((i) => [i.id, i]));

  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("reception-board")!), "Front Desk");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("tomorrow-board")!), "Front Desk");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("onboarding-centre")!), "Team");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("staff-directory-legacy")!), "Team");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("hr-os-dashboard")!), "Team");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("team-staff")!), "Team");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("payments-inbox")!), "Finance");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("financial-os")!), "Finance");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("reports")!), "Reports");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("analytics-legacy")!), "Reports");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("reports-analytics")!), "Reports");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("doctor-workspace")!), "Clinical");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("pathology-nav")!), "Clinical");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("cases-worklist")!), "Surgery");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("surgery-cases")!), "Surgery");
  assert.equal(
    mapCurrentNavItemTo1BDomain(
      items.find((i) => i.id === "surgery-readiness-board")!
    ),
    "Surgery"
  );
});

test("duplicate surfaces are detected for surgery and pipeline overlaps", () => {
  const items = collectFiOsCurrentNavigationModel(TENANT, { includeQuickCreate: false });
  const surgeryOs = items.find((i) => i.id === "surgery-os")!;
  const casesWorklist = items.find((i) => i.id === "cases-worklist")!;
  const surgeryReport = classifyNavigationDrift(surgeryOs, items);
  const casesReport = classifyNavigationDrift(casesWorklist, items);
  assert.equal(surgeryReport.classification, "duplicate_surface");
  assert.ok(surgeryReport.reasons.some((r) => r.includes("cases-worklist")));
  assert.equal(casesReport.classification, "duplicate_surface");

  const crm = items.find((i) => i.id === "crm")!;
  const followUps = items.find((i) => i.id === "follow-up-queue")!;
  assert.equal(classifyNavigationDrift(crm, items).classification, "duplicate_surface");
  assert.equal(classifyNavigationDrift(followUps, items).classification, "duplicate_surface");
});

test("legacy labels are detected for module language", () => {
  const report = buildNavigationDriftReport(TENANT, { includeQuickCreate: false });
  const legacyIds = new Set(report.legacyLabels.map((l) => l.id));
  assert.ok(legacyIds.has("onboarding-centre") || legacyIds.has("patient-twin"));
  assert.ok(report.legacyLabels.length > 0);
});

test("primary rail recommendation does not exceed 6", () => {
  const report = buildNavigationDriftReport(TENANT);
  assert.equal(report.d6PrimaryRailRecommendation.length, 6);
  const summary = summarizeNavigationDrift(report);
  assert.equal(summary.exceedsPrimaryRailLimit, false);
});

test("Calendar remains preserved in catalog and primary rail placement", () => {
  const items = collectFiOsCurrentNavigationModel(TENANT, { includeQuickCreate: false });
  const calendar = items.find((i) => i.id === "calendar");
  assert.ok(calendar);
  assert.ok(calendar!.href.endsWith("/calendar"));
  assert.equal(calendar!.disabled, false);

  const report = buildNavigationDriftReport(TENANT, { includeQuickCreate: false });
  const calendarRow = report.items.find((r) => r.item.id === "calendar");
  assert.ok(calendarRow);
  assert.equal(calendarRow!.d6Placement, "primary_rail");
  assert.equal(calendarRow!.domain1B, "Calendar");
  assert.ok(report.d6PrimaryRailRecommendation.includes("Calendar"));
  assert.ok(report.directRoutesPreserved.includes(calendar!.href));
});

test("surgery consolidated item and front-desk map to 1B groups after D6G-D", () => {
  const items = collectFiOsCurrentNavigationModel(TENANT, { includeQuickCreate: false });
  const surgery = items.find((i) => i.id === "surgery" && i.source === "primary_sidebar")!;
  const surgeryOs = items.find((i) => i.id === "surgery-os")!;
  const frontDesk = items.find((i) => i.id === "front-desk")!;
  const receptionOs = items.find((i) => i.id === "reception-os")!;
  assert.equal(surgery.workflowGroupId, "SURGERY");
  assert.equal(surgeryOs.workflowGroupId, "SURGERY");
  assert.equal(frontDesk.workflowGroupId, "FRONT_DESK");
  assert.equal(receptionOs.workflowGroupId, "FRONT_DESK");
});

test("reports consolidated item maps to REPORTS group after D6G-F", () => {
  const items = collectFiOsCurrentNavigationModel(TENANT, { includeQuickCreate: false });
  const reports = items.find((i) => i.id === "reports" && i.source === "primary_sidebar")!;
  const analyticsLegacy = items.find((i) => i.id === "analytics-legacy")!;
  assert.equal(reports.workflowGroupId, "REPORTS");
  assert.equal(analyticsLegacy.workflowGroupId, "REPORTS");
  assert.equal(mapCurrentNavItemTo1BDomain(reports), "Reports");
});

test("team consolidated item maps to TEAM group after D6G-E", () => {
  const items = collectFiOsCurrentNavigationModel(TENANT, { includeQuickCreate: false });
  const team = items.find((i) => i.id === "team" && i.source === "primary_sidebar")!;
  const workforceHub = items.find((i) => i.id === "workforce-os-hub")!;
  const staffLegacy = items.find((i) => i.id === "staff-directory-legacy")!;
  assert.equal(team.workflowGroupId, "TEAM");
  assert.equal(workforceHub.workflowGroupId, "TEAM");
  assert.equal(staffLegacy.workflowGroupId, "TEAM");
  assert.equal(mapCurrentNavItemTo1BDomain(team), "Team");
});

test("minimal rail catalog includes six D6G-B slots", () => {
  const items = collectFiOsCurrentNavigationModel(TENANT, { includeQuickCreate: false });
  const minimalIds = items
    .filter((i) => i.source === "minimal_rail")
    .map((i) => i.id)
    .sort();
  assert.deepEqual(minimalIds, ["calendar", "more", "patients", "reports", "team", "today"]);
});

test("buildNavigationDriftReport summarizes Team and Reports mappings", () => {
  const report = buildNavigationDriftReport(TENANT, { includeQuickCreate: false });
  assert.ok(report.byDomain1B.Team.some((i) => i.id === "team"));
  assert.ok(report.byDomain1B.Team.some((i) => i.id === "onboarding-centre"));
  assert.ok(report.byDomain1B.Reports.some((i) => i.id === "reports"));
  assert.ok(report.byDomain1B.Finance.length >= 2);
  assert.ok(report.byDomain1B["Front Desk"].length >= 3);
  assert.ok(report.currentNavItemCount > 20);
  assert.ok(report.riskyChanges.length >= 3);
});