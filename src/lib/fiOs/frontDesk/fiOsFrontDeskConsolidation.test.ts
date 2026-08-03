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
import {
  FI_OS_FRONT_DESK_LEGACY_ROUTES,
  FI_OS_FRONT_DESK_NAV_ID,
  FI_OS_FRONT_DESK_TABS,
  buildFiOsFrontDeskBase,
  buildFiOsFrontDeskLegacyHref,
  buildFiOsFrontDeskTabHref,
  buildFrontDeskSidebarSubItems,
  isFiOsFrontDeskConsolidatedPath,
} from "@/src/lib/fiOs/frontDesk/frontDeskWorkspaceCore";

const tenantId = "t-front-desk-1";
const base = `/fi-admin/${tenantId}`;

function fullSidebar() {
  return resolveFiOsPrimarySidebarItems(base, true, true, null, true, true, true, true, true);
}

function moreSections() {
  return buildFiOsSidebarWorkflowSections(fullSidebar(), "reception", {
    tenantBase: base,
    forCollapsedShell: true,
  });
}

function flattenMoreIds(sections = moreSections()) {
  const top = sections.flatMap((s) => s.items.map((i) => i.id));
  const subs = sections.flatMap((s) =>
    s.items.flatMap((i) => i.subItems?.map((sub) => sub.id) ?? [])
  );
  return new Set([...top, ...subs]);
}

test("primary rail has exactly six slots; Front desk is More-only", () => {
  assert.deepEqual(
    [...FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS],
    ["today", "calendar", "patients", "team", "reports", "more"]
  );
  assert.equal(primaryRailSlotIds().length, 6);
  const labels = resolveFiOsMinimalNavItems(base, fullSidebar()).map((i) => i.label);
  assert.ok(!labels.some((l) => l === "Front desk"));
  assert.ok(!isPrimaryRailNavId(FI_OS_FRONT_DESK_NAV_ID));
  assert.ok(labels.includes("Reports"));
  assert.ok(!labels.some((l) => /clinic flow|reception board/i.test(l)));
});

test("More drawer contains Front desk grouping with consolidated destination", () => {
  const frontDesk = moreSections().find((s) => s.groupId === "FRONT_DESK");
  assert.ok(frontDesk);
  const ids = frontDesk!.items.map((i) => i.id);
  assert.deepEqual(ids, [FI_OS_FRONT_DESK_NAV_ID]);
  const item = frontDesk!.items[0];
  assert.equal(item.href, `${base}/front-desk`);
});

test("Front desk destination includes all required tabs and legacy deep links", () => {
  const subs = buildFrontDeskSidebarSubItems(tenantId);
  const subIds = new Set(subs.map((s) => s.id));
  for (const tab of FI_OS_FRONT_DESK_TABS) {
    assert.ok(subIds.has(tab.navSubItemId), `missing tab ${tab.navSubItemId}`);
    assert.ok(isFiOsFrontDeskConsolidatedPath(buildFiOsFrontDeskTabHref(tenantId, tab), base));
  }
  for (const legacy of FI_OS_FRONT_DESK_LEGACY_ROUTES) {
    assert.ok(subIds.has(legacy.id), `missing legacy ${legacy.id}`);
    assert.equal(buildFiOsFrontDeskLegacyHref(tenantId, legacy.suffix), `${base}/${legacy.suffix}`);
  }
});

test("staff Front desk tabs are Today, Tomorrow, and Messages", () => {
  const tabLabels = FI_OS_FRONT_DESK_TABS.map((t) => t.label);
  assert.deepEqual(tabLabels, ["Today", "Tomorrow", "Messages"]);
  assert.deepEqual(
    FI_OS_FRONT_DESK_TABS.map((t) => t.id),
    ["today", "tomorrow", "messages"]
  );
  assert.ok(!tabLabels.includes("Clinic flow"));
  assert.ok(!tabLabels.includes("Reception board"));
  assert.ok(!tabLabels.includes("Reception operations"));
  assert.ok(!tabLabels.includes("Tomorrow board"));
  assert.equal(buildFiOsFrontDeskBase(tenantId), `${base}/front-desk`);
});

test("legacy Front Desk routes remain in nav catalog; staff More hides direct links", () => {
  const catalogIds = new Set(buildFrontDeskSidebarSubItems(tenantId).map((s) => s.id));
  for (const legacy of FI_OS_FRONT_DESK_LEGACY_ROUTES) {
    assert.ok(catalogIds.has(legacy.id), `${legacy.id} should remain in nav catalog`);
  }
  const staffMoreIds = flattenMoreIds();
  for (const legacy of FI_OS_FRONT_DESK_LEGACY_ROUTES) {
    assert.ok(!staffMoreIds.has(legacy.id), `${legacy.id} should be hidden from staff More`);
  }
  assert.equal(getFiOsShellActiveSidebarId(`${base}/operations`, base), "operations-centre");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/reception-os`, base), "reception-os");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/reception`, base), "reception-board");
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/reception-board`, base),
    "reception-board-command"
  );
  assert.equal(getFiOsShellActiveSidebarId(`${base}/tomorrow`, base), "tomorrow-board");
});

test("consolidated front desk paths activate the front-desk nav item", () => {
  assert.equal(getFiOsShellActiveSidebarId(`${base}/front-desk`, base), FI_OS_FRONT_DESK_NAV_ID);
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/front-desk/clinic-flow`, base),
    FI_OS_FRONT_DESK_NAV_ID
  );
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/front-desk/reception-board`, base),
    FI_OS_FRONT_DESK_NAV_ID
  );
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/front-desk/tomorrow`, base),
    FI_OS_FRONT_DESK_NAV_ID
  );
});

test("front desk routes do not activate a primary rail slot (More-only)", () => {
  assert.equal(getFiOsMinimalNavActiveId(`${base}/front-desk`, base), null);
  assert.equal(getFiOsMinimalNavActiveId(`${base}/operations`, base), null);
  assert.equal(getFiOsMinimalNavActiveId(`${base}/reception-os`, base), null);
});

test("Calendar route and minimal rail link remain unchanged", () => {
  const sidebar = fullSidebar();
  const calendarSidebar = sidebar.find((i) => i.id === "calendar");
  const calendarRail = resolveFiOsMinimalNavItems(base, sidebar).find((i) => i.id === "calendar");
  assert.equal(calendarRail?.kind, "link");
  if (calendarRail?.kind === "link") {
    assert.equal(calendarRail.href, `${base}/calendar`);
    assert.equal(calendarRail.disabled, calendarSidebar?.disabled ?? false);
  }
  assert.equal(getFiOsMinimalNavActiveId(`${base}/calendar`, base), "calendar");
});
