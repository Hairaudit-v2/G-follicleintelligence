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
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("staff")!), "Team");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("hr-os")!), "Team");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("payments-inbox")!), "Finance");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("financial-os")!), "Finance");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("analytics")!), "Reports");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("auditos")!), "Reports");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("doctor-workspace")!), "Clinical");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("pathology-nav")!), "Clinical");
  assert.equal(mapCurrentNavItemTo1BDomain(byId.get("cases")!), "Surgery");
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
  const cases = items.find((i) => i.id === "cases")!;
  const surgeryReport = classifyNavigationDrift(surgeryOs, items);
  const casesReport = classifyNavigationDrift(cases, items);
  assert.equal(surgeryReport.classification, "duplicate_surface");
  assert.ok(surgeryReport.reasons.some((r) => r.includes("cases")));
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

test("surgery-os and front-desk map to 1B Surgery and Front desk groups after D6G-C", () => {
  const items = collectFiOsCurrentNavigationModel(TENANT, { includeQuickCreate: false });
  const surgeryOs = items.find((i) => i.id === "surgery-os")!;
  const frontDesk = items.find((i) => i.id === "front-desk")!;
  const receptionOs = items.find((i) => i.id === "reception-os")!;
  assert.equal(surgeryOs.workflowGroupId, "SURGERY");
  assert.equal(frontDesk.workflowGroupId, "FRONT_DESK");
  assert.equal(receptionOs.workflowGroupId, "FRONT_DESK");

  const surgeryDrift = classifyNavigationDrift(surgeryOs, items);
  assert.equal(surgeryDrift.classification, "duplicate_surface");
  assert.equal(surgeryDrift.d6Placement, "grouped_under_more");
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
  assert.ok(report.byDomain1B.Team.some((i) => i.id === "staff"));
  assert.ok(report.byDomain1B.Team.some((i) => i.id === "onboarding-centre"));
  assert.ok(report.byDomain1B.Reports.some((i) => i.id === "analytics"));
  assert.ok(report.byDomain1B.Finance.length >= 2);
  assert.ok(report.byDomain1B["Front Desk"].length >= 3);
  assert.ok(report.currentNavItemCount > 20);
  assert.ok(report.riskyChanges.length >= 3);
});