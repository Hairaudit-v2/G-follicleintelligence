import assert from "node:assert/strict";
import test from "node:test";

import {
  getFiOsMinimalNavActiveId,
  primaryRailSlotIds,
  resolveFiOsMinimalNavItems,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import {
  getFiOsShellActiveSidebarId,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import {
  FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS,
  isPrimaryRailNavId,
} from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";
import { labelHasLegacyModuleLanguage } from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";
import {
  FI_OS_FRONT_DESK_NAV_ID,
  buildFiOsFrontDeskBase,
} from "@/src/lib/fiOs/frontDesk/frontDeskWorkspaceCore";
import {
  FI_OS_SURGERY_ADMIN_LEGACY_ROUTES,
  FI_OS_SURGERY_LEGACY_ROUTES,
  FI_OS_SURGERY_NAV_ID,
  FI_OS_SURGERY_TABS,
  buildFiOsSurgeryBase,
  buildFiOsSurgeryLegacyHref,
  buildFiOsSurgeryTabHref,
  buildFiOsSurgeryTenantBase,
  buildSurgerySidebarSubItems,
  isFiOsSurgeryConsolidatedPath,
  isSurgeryTabActive,
  resolveSurgeryTabFromPath,
  surgerySubItemUsesStaffFriendlyLabel,
} from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";

const tenantId = "t-surgery-1";
const base = `/fi-admin/${tenantId}`;

function fullSidebar(showSurgeryAdmin = false) {
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
    showSurgeryAdmin
  );
}

function moreSections(showSurgeryAdmin = false) {
  return buildFiOsSidebarWorkflowSections(fullSidebar(showSurgeryAdmin), "surgeon", {
    tenantBase: base,
    forCollapsedShell: true,
    showProcedureDayNav: true,
    showSurgeryAdminSurfaces: showSurgeryAdmin,
  });
}

function flattenMoreIds(sections = moreSections()) {
  const top = sections.flatMap((s) => s.items.map((i) => i.id));
  const subs = sections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  return new Set([...top, ...subs]);
}

test("primary rail still has exactly six slots and excludes Surgery", () => {
  assert.deepEqual(
    [...FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS],
    ["today", "calendar", "patients", "front-desk", "team", "more"]
  );
  assert.equal(primaryRailSlotIds().length, 6);
  const labels = resolveFiOsMinimalNavItems(base, fullSidebar()).map((i) => i.label);
  assert.ok(!labels.some((l) => /^surgery$/i.test(l)));
  assert.ok(!isPrimaryRailNavId(FI_OS_SURGERY_NAV_ID));
});

test("More contains one Surgery group with consolidated destination", () => {
  const surgery = moreSections().find((s) => s.groupId === "SURGERY");
  assert.ok(surgery);
  assert.deepEqual(
    surgery!.items.map((i) => i.id),
    [FI_OS_SURGERY_NAV_ID]
  );
  assert.equal(surgery!.items[0]!.href, `${base}/surgery`);
});

test("Surgery workspace exposes command, cases, procedure day, and review tabs", () => {
  const subs = buildSurgerySidebarSubItems(tenantId, {
    showProcedureDayNav: true,
    casesBlocked: false,
  });
  const subIds = new Set(subs.map((s) => s.id));
  for (const tab of FI_OS_SURGERY_TABS) {
    assert.ok(subIds.has(tab.navSubItemId));
    assert.ok(isFiOsSurgeryConsolidatedPath(buildFiOsSurgeryTabHref(tenantId, tab), base));
  }
  assert.equal(buildFiOsSurgeryBase(tenantId), `${base}/surgery`);
});

test("surgery tab active-state matches its own href and not siblings", () => {
  const tenantBase = buildFiOsSurgeryTenantBase(tenantId);
  assert.equal(tenantBase, base);
  for (const tab of FI_OS_SURGERY_TABS) {
    const href = buildFiOsSurgeryTabHref(tenantId, tab);
    assert.equal(isSurgeryTabActive(href, tenantBase, tab.segment), true, tab.id);
    for (const other of FI_OS_SURGERY_TABS) {
      if (other.id === tab.id) continue;
      assert.equal(
        isSurgeryTabActive(href, tenantBase, other.segment),
        false,
        `${other.id} must not be active on ${tab.id}`
      );
    }
  }
  // Regression: workspace base must not be passed (would always be inactive).
  const workspaceBase = buildFiOsSurgeryBase(tenantId);
  assert.equal(isSurgeryTabActive(`${base}/surgery`, workspaceBase, ""), false);
  assert.equal(isSurgeryTabActive(`${base}/surgery`, tenantBase, ""), true);
  assert.equal(resolveSurgeryTabFromPath(`${base}/surgery/cases`, tenantBase), "cases");
  assert.equal(resolveSurgeryTabFromPath(`${base}/surgery/review`, tenantBase), "review");
});

test("legacy Surgery routes remain in nav catalog; staff More hides direct links", () => {
  const catalogIds = new Set(
    buildSurgerySidebarSubItems(tenantId, { showProcedureDayNav: true }).map((s) => s.id)
  );
  for (const legacy of FI_OS_SURGERY_LEGACY_ROUTES) {
    assert.ok(catalogIds.has(legacy.id), `${legacy.id} should remain in nav catalog`);
    assert.equal(buildFiOsSurgeryLegacyHref(tenantId, legacy.suffix), `${base}/${legacy.suffix}`);
  }
  const staffMoreIds = flattenMoreIds();
  for (const legacy of FI_OS_SURGERY_LEGACY_ROUTES) {
    if (legacy.id === "procedure-day-board") continue;
    assert.ok(!staffMoreIds.has(legacy.id), `${legacy.id} should be hidden from staff More`);
  }
  assert.equal(getFiOsShellActiveSidebarId(`${base}/surgery-os`, base), "surgery-os");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/cases`, base), "cases-worklist");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/procedure-day`, base), "procedure-day-board");
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/surgery-os/intelligence`, base),
    "surgery-intelligence-dashboard"
  );
});

test("consolidated surgery paths activate the surgery nav item", () => {
  assert.equal(getFiOsShellActiveSidebarId(`${base}/surgery`, base), FI_OS_SURGERY_NAV_ID);
  assert.equal(getFiOsShellActiveSidebarId(`${base}/surgery/cases`, base), FI_OS_SURGERY_NAV_ID);
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/surgery/procedure-day`, base),
    FI_OS_SURGERY_NAV_ID
  );
  assert.equal(getFiOsShellActiveSidebarId(`${base}/surgery/review`, base), FI_OS_SURGERY_NAV_ID);
});

test("staff-facing surgery sub-items avoid module-heavy intelligence labels", () => {
  const staffSubs = buildSurgerySidebarSubItems(tenantId, { showSurgeryAdminSurfaces: false });
  for (const sub of staffSubs) {
    assert.ok(surgerySubItemUsesStaffFriendlyLabel(sub.label), sub.label);
    assert.ok(!labelHasLegacyModuleLanguage(sub.label), sub.label);
  }
  const review = staffSubs.find((s) => s.id === "surgery-review");
  assert.equal(review?.label, "Review");
});

test("platform admin retains surgery intelligence and graft tray legacy direct links", () => {
  const adminSubs = buildSurgerySidebarSubItems(tenantId, {
    showProcedureDayNav: true,
    showSurgeryAdminSurfaces: true,
  });
  const adminIds = new Set(adminSubs.map((s) => s.id));
  for (const route of FI_OS_SURGERY_ADMIN_LEGACY_ROUTES) {
    assert.ok(adminIds.has(route.id), `admin should see ${route.id}`);
  }
  const adminMore = flattenMoreIds(moreSections(true));
  assert.ok(adminMore.has("surgery-intelligence-dashboard"));
  assert.ok(adminMore.has("graft-counting-legacy"));
});

test("surgery routes do not activate primary minimal rail slots", () => {
  assert.equal(getFiOsMinimalNavActiveId(`${base}/surgery`, base), null);
  assert.equal(getFiOsMinimalNavActiveId(`${base}/surgery-os`, base), null);
});

test("Calendar and Front Desk D6G-C routes remain unchanged", () => {
  const sidebar = fullSidebar();
  const calendarRail = resolveFiOsMinimalNavItems(base, sidebar).find((i) => i.id === "calendar");
  assert.equal(calendarRail?.kind, "link");
  if (calendarRail?.kind === "link") {
    assert.equal(calendarRail.href, `${base}/calendar`);
  }
  const frontDesk = sidebar.find((i) => i.id === FI_OS_FRONT_DESK_NAV_ID);
  assert.ok(frontDesk?.href.endsWith("/front-desk"));
  assert.equal(buildFiOsFrontDeskBase(tenantId), `${base}/front-desk`);
});
