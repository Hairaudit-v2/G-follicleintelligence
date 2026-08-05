import assert from "node:assert/strict";
import test from "node:test";

import {
  getFiOsMinimalNavActiveId,
  primaryRailSlotIds,
  resolveFiOsMinimalNavItems,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import { resolveFiOsPrimarySidebarItems } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import {
  FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS,
  FI_OS_HIDDEN_MORE_SUB_ITEM_IDS,
  FI_OS_LEGACY_MORE_SUB_ITEM_IDS,
  isPrimaryRailNavId,
  isStaffHiddenMoreDrawerLabel,
} from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";
import { labelHasLegacyModuleLanguage } from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";

const base = "/fi-admin/t-regroup-1";

function fullSidebar(showAdmin = false) {
  return resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true,
    showAdmin,
    showAdmin,
    undefined,
    showAdmin
  );
}

function moreSections(opts?: {
  showNavigationAdminSurfaces?: boolean;
  showProcedureDayNav?: boolean;
  showTeamAdminSurfaces?: boolean;
  showReportsAdminSurfaces?: boolean;
}) {
  const showAdmin =
    opts?.showNavigationAdminSurfaces === true ||
    opts?.showReportsAdminSurfaces === true ||
    opts?.showTeamAdminSurfaces === true;
  const sidebar = fullSidebar(showAdmin);
  return buildFiOsSidebarWorkflowSections(sidebar, "default", {
    tenantBase: base,
    forCollapsedShell: true,
    showNavigationAdminSurfaces: opts?.showNavigationAdminSurfaces ?? false,
    showProcedureDayNav: opts?.showProcedureDayNav ?? false,
    showSurgeryAdminSurfaces: opts?.showNavigationAdminSurfaces ?? false,
    showTeamAdminSurfaces:
      opts?.showTeamAdminSurfaces ?? opts?.showNavigationAdminSurfaces ?? false,
    showReportsAdminSurfaces:
      opts?.showReportsAdminSurfaces ?? opts?.showNavigationAdminSurfaces ?? false,
    showSettingsAdminSurfaces:
      opts?.showNavigationAdminSurfaces ?? opts?.showReportsAdminSurfaces ?? false,
  });
}

function allMoreItemIds(sections = moreSections()) {
  return sections.flatMap((s) => s.items.map((i) => i.id));
}

test("primary rail has exactly six slots in canonical order", () => {
  assert.deepEqual(
    [...FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS],
    ["today", "calendar", "patients", "team", "reports", "more"]
  );
  assert.equal(primaryRailSlotIds().length, 6);
});

test("minimal nav exposes Today, Calendar, Patients, Team, Reports, More", () => {
  const sidebar = fullSidebar();
  const items = resolveFiOsMinimalNavItems(base, sidebar);
  assert.equal(items.length, 6);
  assert.deepEqual(
    items.map((i) => i.id),
    ["today", "calendar", "patients", "team", "reports", "more"]
  );
  assert.deepEqual(
    items.map((i) => i.label),
    ["Today", "Calendar", "Patients", "Team", "Reports", "More"]
  );
});

test("Calendar route and href are unchanged on minimal rail", () => {
  const sidebar = fullSidebar();
  const calendarSidebar = sidebar.find((i) => i.id === "calendar");
  const calendarRail = resolveFiOsMinimalNavItems(base, sidebar).find((i) => i.id === "calendar");
  assert.ok(calendarSidebar);
  assert.equal(calendarRail?.kind, "link");
  if (calendarRail?.kind === "link") {
    assert.equal(calendarRail.href, `${base}/calendar`);
    assert.equal(calendarRail.disabled, calendarSidebar?.disabled ?? false);
  }
});

function flattenMoreIds(sections = moreSections()) {
  const top = sections.flatMap((s) => s.items.map((i) => i.id));
  const subs = sections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  return new Set([...top, ...subs]);
}

function flattenMoreSubLabels(sections = moreSections()) {
  return sections.flatMap((s) => s.items.flatMap((i) => i.subItems?.map((sub) => sub.label) ?? []));
}

test("secondary workflow routes remain in More drawer after regrouping", () => {
  const ids = flattenMoreIds();
  assert.ok(ids.has("front-desk"));
  assert.ok(ids.has("inbox"));
  for (const expected of [
    "crm",
    "consultations",
    "surgery",
    "reports",
    "team",
    "doctor-workspace",
    "prescriptions",
    "pathology-nav",
  ]) {
    assert.ok(ids.has(expected), `expected ${expected} in More drawer`);
  }
});

test("receptionist More drawer hides legacy direct and admin labels", () => {
  const staffSections = moreSections({ showNavigationAdminSurfaces: false });
  const subIds = staffSections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  const subLabels = flattenMoreSubLabels(staffSections);

  for (const legacyId of FI_OS_LEGACY_MORE_SUB_ITEM_IDS) {
    if (legacyId === "procedure-day-board") continue;
    assert.ok(!subIds.includes(legacyId), `staff More should hide legacy ${legacyId}`);
  }
  for (const hiddenId of FI_OS_HIDDEN_MORE_SUB_ITEM_IDS) {
    if (hiddenId === "procedure-day-board") continue;
    assert.ok(!subIds.includes(hiddenId), `staff More should hide admin ${hiddenId}`);
  }
  for (const label of subLabels) {
    assert.ok(!isStaffHiddenMoreDrawerLabel(label), `staff More should hide label: ${label}`);
    assert.ok(!/\(direct\)/i.test(label), `staff More should hide direct label: ${label}`);
  }
});

test("platform admin More drawer retains legacy direct and D6 admin links", () => {
  const adminSections = moreSections({
    showNavigationAdminSurfaces: true,
    showReportsAdminSurfaces: true,
    showProcedureDayNav: true,
  });
  const adminSubIds = adminSections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  assert.ok(adminSubIds.includes("reception-os"));
  assert.ok(adminSubIds.includes("surgery-os"));
  // A1: Team legacy direct links are never advertised, even for admins.
  assert.ok(!adminSubIds.includes("workforce-os-hub"));
  assert.ok(adminSubIds.includes("analytics-legacy"));
  for (const d6Id of ["d6-presence", "d6-signal-learning", "d6-bake", "d6-navigation-audit"]) {
    assert.ok(adminSubIds.includes(d6Id), `admin More should include ${d6Id}`);
  }
});

test("primary rail destinations are excluded from collapsed More drawer", () => {
  const ids = new Set(allMoreItemIds());
  // Pure rail destinations (no deeper More tabs) drop from collapsed More.
  for (const railId of ["dashboard", "calendar", "patients"]) {
    assert.ok(!ids.has(railId), `${railId} should not duplicate on More when collapsed`);
    assert.ok(isPrimaryRailNavId(railId));
  }
  // Team + Reports stay in More for deeper tab discovery while also on the rail.
  assert.ok(ids.has("team"), "Team deeper items remain in More when collapsed");
  assert.ok(ids.has("reports"), "Reports deeper items remain in More when collapsed");
  assert.ok(isPrimaryRailNavId("team"));
  assert.ok(isPrimaryRailNavId("reports"));
  assert.ok(ids.has("front-desk"), "Front desk should live in More when collapsed");
  assert.ok(ids.has("surgery"), "Surgery should live in More when collapsed");
  assert.ok(!isPrimaryRailNavId("front-desk"));
  assert.ok(!isPrimaryRailNavId("surgery"));
});

test("Front desk and Surgery are More-only; no Surgery on primary rail", () => {
  const labels = resolveFiOsMinimalNavItems(base, fullSidebar()).map((i) => i.label);
  const frontDeskLabels = labels.filter((l) => /^front desk$/i.test(l));
  const surgeryLabels = labels.filter((l) => /surgery|cases|procedure/i.test(l));
  assert.equal(frontDeskLabels.length, 0);
  assert.equal(surgeryLabels.length, 0);
  assert.ok(!labels.some((l) => /clinic flow|reception board|tomorrow/i.test(l)));
});

test("Team sits on primary rail with consolidated href", () => {
  const teamRail = resolveFiOsMinimalNavItems(base, fullSidebar()).find((i) => i.id === "team");
  assert.equal(teamRail?.kind, "link");
  if (teamRail?.kind === "link") {
    assert.ok(teamRail.href.endsWith("/team") || teamRail.href.includes("/team/"));
  }
});

test("Reports sits on primary rail; D6 admin deeper items when allowed", () => {
  const reportsRail = resolveFiOsMinimalNavItems(base, fullSidebar()).find(
    (i) => (i.id as string) === "reports"
  );
  assert.ok(reportsRail);
  assert.equal(reportsRail?.kind, "link");

  const staffSections = moreSections({ showNavigationAdminSurfaces: false });
  const staffReports = staffSections.find((s) => s.groupId === "REPORTS");
  assert.ok(staffReports);
  assert.deepEqual(
    staffReports!.items.map((i) => i.id),
    ["reports"]
  );
  const staffSubIds = staffReports!.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []);
  assert.ok(staffSubIds.includes("reports-analytics"));
  assert.ok(!staffSubIds.includes("analytics-legacy"));
  assert.ok(!staffSubIds.includes("d6-presence"));

  const adminSections = moreSections({
    showNavigationAdminSurfaces: true,
    showReportsAdminSurfaces: true,
  });
  const adminReports = adminSections.find((s) => s.groupId === "REPORTS");
  assert.ok(adminReports);
  const adminReportSubIds = adminReports!.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []);
  assert.ok(!adminReportSubIds.includes("d6-presence"));

  const adminSettings = adminSections.find((s) => s.groupId === "SETTINGS");
  assert.ok(adminSettings);
  const adminSettingsSubIds =
    adminSettings!.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []) ?? [];
  for (const d6Id of ["d6-presence", "d6-signal-learning", "d6-bake", "d6-navigation-audit"]) {
    assert.ok(adminSettingsSubIds.includes(d6Id), `admin Settings should include ${d6Id}`);
  }
});

test("Pipeline workflow group exposes Inbox and Pipeline doors in More drawer", () => {
  const pipeline = moreSections().find((s) => s.groupId === "PIPELINE");
  assert.ok(pipeline);
  assert.deepEqual(
    pipeline!.items.map((i) => i.id),
    ["inbox", "crm"]
  );
  assert.equal(pipeline!.items[0]!.label, "Inbox");
  assert.ok(pipeline!.items[0]!.href.endsWith("/inbox"));
  assert.equal(pipeline!.items[1]!.label, "Pipeline");
  assert.ok(pipeline!.items[1]!.href.endsWith("/crm"));
});

test("Front Desk and Surgery workflow groups consolidate duplicate surfaces in More only", () => {
  const frontDesk = moreSections().find((s) => s.groupId === "FRONT_DESK");
  const surgery = moreSections().find((s) => s.groupId === "SURGERY");
  assert.ok(frontDesk);
  assert.ok(surgery);
  const frontIds = frontDesk!.items.map((i) => i.id);
  const frontSubIds = frontDesk!.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []);
  const surgeryIds = surgery!.items.map((i) => i.id);
  const surgerySubIds = surgery!.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []);
  assert.deepEqual(frontIds, ["front-desk"]);
  assert.ok(frontSubIds.includes("front-desk-today"));
  assert.ok(frontSubIds.includes("front-desk-tomorrow"));
  assert.ok(frontSubIds.includes("front-desk-messages"));
  assert.ok(!frontSubIds.includes("front-desk-clinic-flow"));
  assert.ok(!frontSubIds.includes("front-desk-reception-board"));
  assert.ok(!frontSubIds.includes("reception-os"));
  assert.ok(!frontSubIds.includes("operations-centre"));
  assert.deepEqual(surgeryIds, ["surgery"]);
  assert.ok(surgerySubIds.includes("surgery-command"));
  assert.ok(surgerySubIds.includes("surgery-cases"));
  assert.ok(!surgerySubIds.includes("surgery-os"));
  assert.ok(!surgerySubIds.includes("cases-worklist"));
  const team = moreSections().find((s) => s.groupId === "TEAM");
  const teamSubIds = team?.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []) ?? [];
  assert.ok(teamSubIds.includes("team-staff"));
  assert.ok(!teamSubIds.includes("workforce-os-hub"));
});

test("receptionist profile minimal rail uses workflow labels without module language", () => {
  const items = resolveFiOsMinimalNavItems(base, fullSidebar());
  for (const item of items) {
    assert.ok(!labelHasLegacyModuleLanguage(item.label), `${item.label} is module-heavy`);
  }
});

test("hidden sub-items stay out of More unless procedure day is explicitly enabled", () => {
  const withoutProcedureDay = moreSections({ showProcedureDayNav: false });
  const surgery = withoutProcedureDay.find((s) => s.groupId === "SURGERY");
  const subIds = surgery?.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []) ?? [];
  for (const hidden of FI_OS_HIDDEN_MORE_SUB_ITEM_IDS) {
    if (hidden === "procedure-day-board") continue;
    assert.ok(!subIds.includes(hidden), `${hidden} should be hidden from More`);
  }

  const withProcedureDay = moreSections({ showProcedureDayNav: true });
  const surgeryWithDay = withProcedureDay.find((s) => s.groupId === "SURGERY");
  const subIdsWithDay =
    surgeryWithDay?.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []) ?? [];
  assert.ok(subIdsWithDay.includes("procedure-day-board"));
});

test("minimal nav active ids cover team and reports deep links", () => {
  assert.equal(getFiOsMinimalNavActiveId(`${base}/team`, base), "team");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/workforce-os`, base), "team");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/staff`, base), "team");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/reports`, base), "reports");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/analytics`, base), "reports");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/intelligence/navigation-audit`, base), "reports");
  // Front desk / surgery live in More only — no primary-rail active slot
  assert.equal(getFiOsMinimalNavActiveId(`${base}/front-desk`, base), null);
  assert.equal(getFiOsMinimalNavActiveId(`${base}/surgery`, base), null);
});
