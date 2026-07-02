import assert from "node:assert/strict";
import test from "node:test";

import {
  FI_OS_SIDEBAR_NAV_SCROLL,
  FI_OS_TOP_CHROME_OFFSET_FALLBACK,
  buildFiOsChromeViewportStyle,
  fiOsChromeClasses,
  fiOsChromeCssVars,
} from "@/src/components/fi-os/fiOsChromeTokens";
import {
  filterFiOsPrimarySidebarItemsByFeatureAccess,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { buildFiOsSidebarWorkflowSections } from "@/src/lib/fi-os/fiOsSidebarWorkflow";

const SCROLL_CHAIN = ["min-h-0", "overflow-y-auto", "overscroll-y-contain"] as const;

function assertIncludesAll(haystack: string, needles: readonly string[], label: string) {
  for (const needle of needles) {
    assert.ok(haystack.includes(needle), `${label} must include "${needle}"`);
  }
}

test("fiOsChromeClasses: shell locks viewport height without blocking nested scroll regions", () => {
  assertIncludesAll(fiOsChromeClasses.shellRoot, ["h-[100dvh]", "max-h-[100dvh]", "overflow-hidden"], "shellRoot");
  assertIncludesAll(fiOsChromeClasses.shellBody, ["min-h-0", "overflow-hidden"], "shellBody");
  assert.ok(
    fiOsChromeClasses.mainScroll.includes("overflow-y-auto"),
    "mainScroll keeps independent main-column scroll"
  );
  assert.ok(
    fiOsChromeClasses.mainScrollCalendarLock.includes("overflow-hidden"),
    "calendar lock still contains main scroll inside calendar subtree"
  );
});

test("fiOsChromeClasses: sidebar rail and drawer establish scroll boundaries", () => {
  assertIncludesAll(
    fiOsChromeClasses.sidebarRail,
    ["min-h-0", "overflow-hidden", "self-stretch"],
    "sidebarRail"
  );
  assertIncludesAll(
    fiOsChromeClasses.sidebarDrawer,
    ["min-h-0", "max-h-[100dvh]", "overflow-hidden"],
    "sidebarDrawer"
  );
  assertIncludesAll(fiOsChromeClasses.sidebarNavScroll, SCROLL_CHAIN, "sidebarNavScroll");
  assert.ok(
    fiOsChromeClasses.sidebarNavScroll.includes("safe-area-inset-bottom"),
    "sidebarNavScroll respects mobile safe-area insets"
  );
  assert.equal(fiOsChromeClasses.sidebarNavScroll, FI_OS_SIDEBAR_NAV_SCROLL);
});

test("fiOsChromeClasses: right drawer viewport respects measured chrome offsets", () => {
  assertIncludesAll(
    fiOsChromeClasses.rightDrawerOverlay,
    [
      "fixed",
      "inset-x-0",
      `var(${fiOsChromeCssVars.topOffset}`,
      FI_OS_TOP_CHROME_OFFSET_FALLBACK,
      `var(${fiOsChromeCssVars.bottomOffset}`,
      "safe-area-inset-bottom",
    ],
    "rightDrawerOverlay"
  );
  assertIncludesAll(
    fiOsChromeClasses.rightDrawerPanel,
    ["h-full", "max-h-full", "overflow-hidden", "flex-col"],
    "rightDrawerPanel"
  );
  assertIncludesAll(
    fiOsChromeClasses.rightDrawerBodyScroll,
    ["min-h-0", "flex-1", "overflow-y-auto", "overscroll-y-contain"],
    "rightDrawerBodyScroll"
  );
  assert.ok(
    fiOsChromeClasses.rightDrawerHeader.includes("shrink-0"),
    "rightDrawerHeader stays visible"
  );
  assert.ok(
    fiOsChromeClasses.rightDrawerFooter.includes("shrink-0"),
    "rightDrawerFooter stays reachable"
  );
});

test("buildFiOsChromeViewportStyle: clamps negative measurements to zero px", () => {
  const style = buildFiOsChromeViewportStyle(-4, 12.7) as Record<string, string>;
  assert.equal(style[fiOsChromeCssVars.topOffset], "0px");
  assert.equal(style[fiOsChromeCssVars.bottomOffset], "13px");
});

test("fiOs sidebar workflow: lower-priority modules remain in nav sections", () => {
  const base = "/fi-admin/t-1";
  const items = filterFiOsPrimarySidebarItemsByFeatureAccess(
    resolveFiOsPrimarySidebarItems(
      base,
      true,
      true,
      null,
      true,
      true,
      true,
      true,
      true
    ),
    null
  );
  const sections = buildFiOsSidebarWorkflowSections(items, "default");
  const flatIds = sections.flatMap((section) => section.items.map((item) => item.id));

  for (const id of ["patients", "staff", "crm", "settings"]) {
    assert.ok(flatIds.includes(id), `expected nav section to include "${id}"`);
  }
});
