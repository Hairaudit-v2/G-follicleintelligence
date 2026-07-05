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
  isPrimaryRailNavId,
} from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";
import { labelHasLegacyModuleLanguage } from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";

const base = "/fi-admin/t-regroup-1";

function fullSidebar() {
  return resolveFiOsPrimarySidebarItems(
    base,
    true,
    true,
    null,
    true,
    true,
    true,
    true,
    true
  );
}

function moreSections(opts?: {
  showNavigationAdminSurfaces?: boolean;
  showProcedureDayNav?: boolean;
}) {
  const sidebar = fullSidebar();
  return buildFiOsSidebarWorkflowSections(sidebar, "default", {
    tenantBase: base,
    forCollapsedShell: true,
    showNavigationAdminSurfaces: opts?.showNavigationAdminSurfaces ?? false,
    showProcedureDayNav: opts?.showProcedureDayNav ?? false,
  });
}

function allMoreItemIds(sections = moreSections()) {
  return sections.flatMap((s) => s.items.map((i) => i.id));
}

test("primary rail has exactly six slots in canonical order", () => {
  assert.deepEqual([...FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS], [
    "today",
    "calendar",
    "patients",
    "team",
    "reports",
    "more",
  ]);
  assert.equal(primaryRailSlotIds().length, 6);
});

test("minimal nav exposes Today, Calendar, Patients, Team, Reports, More", () => {
  const sidebar = fullSidebar();
  const items = resolveFiOsMinimalNavItems(base, sidebar);
  assert.equal(items.length, 6);
  assert.deepEqual(items.map((i) => i.id), [
    "today",
    "calendar",
    "patients",
    "team",
    "reports",
    "more",
  ]);
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

test("secondary workflow routes remain in More drawer after regrouping", () => {
  const ids = flattenMoreIds();
  assert.ok(ids.has("front-desk"));
  for (const expected of [
    "operations-centre",
    "reception-os",
    "reception-board",
    "tomorrow-board",
    "crm",
    "follow-up-queue",
    "consultations",
    "cases",
    "surgery-os",
    "doctor-workspace",
    "prescriptions",
    "pathology-nav",
  ]) {
    assert.ok(ids.has(expected), `expected ${expected} in More drawer`);
  }
});

test("primary rail destinations are excluded from collapsed More drawer", () => {
  const ids = new Set(allMoreItemIds());
  for (const railId of ["dashboard", "calendar", "patients", "hr-os", "analytics"]) {
    assert.ok(!ids.has(railId), `${railId} should not duplicate on More when collapsed`);
    assert.ok(isPrimaryRailNavId(railId));
  }
});

test("no duplicate Front Desk or Surgery rows on primary minimal rail", () => {
  const labels = resolveFiOsMinimalNavItems(base, fullSidebar()).map((i) => i.label);
  const frontDeskLabels = labels.filter((l) =>
    /clinic flow|front desk|reception|tomorrow/i.test(l)
  );
  const surgeryLabels = labels.filter((l) => /surgery|cases|procedure/i.test(l));
  assert.equal(frontDeskLabels.length, 0);
  assert.equal(surgeryLabels.length, 0);
});

test("Team grouping in More includes staff, onboarding, and academy; hr-os stays on primary rail", () => {
  const team = moreSections().find((s) => s.groupId === "TEAM");
  assert.ok(team);
  const ids = new Set(team!.items.map((i) => i.id));
  assert.ok(ids.has("staff"));
  assert.ok(ids.has("academyos"));
  assert.ok(ids.has("onboarding-centre"));
  assert.ok(!ids.has("hr-os"));

  const teamRail = resolveFiOsMinimalNavItems(base, fullSidebar()).find((i) => i.id === "team");
  assert.equal(teamRail?.kind, "link");
  if (teamRail?.kind === "link") {
    assert.ok(teamRail.href.endsWith("/workforce-os"));
  }
});

test("Reports grouping includes auditos in More and analytics on primary rail; D6 admin when allowed", () => {
  const reportsRail = resolveFiOsMinimalNavItems(base, fullSidebar()).find((i) => i.id === "reports");
  assert.equal(reportsRail?.kind, "link");
  if (reportsRail?.kind === "link") {
    assert.ok(reportsRail.href.endsWith("/analytics"));
  }

  const staffSections = moreSections({ showNavigationAdminSurfaces: false });
  const staffReports = staffSections.find((s) => s.groupId === "REPORTS");
  assert.ok(staffReports);
  const staffIds = staffReports!.items.map((i) => i.id);
  assert.ok(staffIds.includes("auditos"));
  assert.ok(!staffIds.includes("analytics"));
  assert.ok(!staffIds.includes("d6-presence"));

  const adminSections = moreSections({ showNavigationAdminSurfaces: true });
  const adminReports = adminSections.find((s) => s.groupId === "REPORTS");
  assert.ok(adminReports);
  const adminIds = adminReports!.items.map((i) => i.id);
  for (const d6Id of ["d6-presence", "d6-signal-learning", "d6-bake", "d6-navigation-audit"]) {
    assert.ok(adminIds.includes(d6Id), `admin Reports should include ${d6Id}`);
  }
});

test("Front Desk and Surgery workflow groups consolidate duplicate surfaces in More only", () => {
  const frontDesk = moreSections().find((s) => s.groupId === "FRONT_DESK");
  const surgery = moreSections().find((s) => s.groupId === "SURGERY");
  assert.ok(frontDesk);
  assert.ok(surgery);
  const frontIds = frontDesk!.items.map((i) => i.id);
  const frontSubIds = frontDesk!.items.flatMap((i) => i.subItems?.map((s) => s.id) ?? []);
  const surgeryIds = surgery!.items.map((i) => i.id);
  assert.deepEqual(frontIds, ["front-desk"]);
  assert.ok(frontSubIds.includes("reception-os"));
  assert.ok(frontSubIds.includes("reception-board"));
  assert.ok(surgeryIds.includes("surgery-os"));
  assert.ok(surgeryIds.includes("cases"));
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
  assert.equal(getFiOsMinimalNavActiveId(`${base}/workforce-os`, base), "team");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/staff`, base), "team");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/analytics`, base), "reports");
  assert.equal(getFiOsMinimalNavActiveId(`${base}/intelligence/navigation-audit`, base), "reports");
});