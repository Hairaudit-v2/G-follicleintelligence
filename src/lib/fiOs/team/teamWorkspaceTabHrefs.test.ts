import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  FI_OS_TEAM_TABS,
  buildFiOsTeamBase,
  buildFiOsTeamTabHref,
  buildFiOsTeamTenantBase,
  isTeamTabActive,
} from "@/src/lib/fiOs/team/teamWorkspaceCore";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEAM_SUB_NAV = "src/components/fi-os/team/TeamSubNav.tsx";
const TEAM_LAYOUT = "app/(fi-admin)/fi-admin/[tenantId]/team/layout.tsx";
const TEAM_LOADING = "app/(fi-admin)/fi-admin/[tenantId]/team/loading.tsx";
const TEAM_TEMPLATE = "app/(fi-admin)/fi-admin/[tenantId]/team/template.tsx";
const TEAM_FALLBACK = "src/components/fi-os/team/TeamWorkspacePageFallback.tsx";

test("every team workspace tab builds a non-empty tenant-scoped href", () => {
  const base = buildFiOsTeamBase(TENANT);
  assert.equal(base, `/fi-admin/${TENANT}/team`);

  const hrefs = FI_OS_TEAM_TABS.map((tab) => buildFiOsTeamTabHref(TENANT, tab));
  for (const href of hrefs) {
    assert.ok(href.startsWith(base), `href must live under the team base: ${href}`);
    assert.ok(!href.includes("//"), `href must not contain empty segments: ${href}`);
    assert.ok(href.includes(TENANT), `href must include tenantId: ${href}`);
  }
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test("team tabs cover the seven workspace surfaces with expected segments", () => {
  const segments = Object.fromEntries(FI_OS_TEAM_TABS.map((tab) => [tab.id, tab.segment]));
  assert.deepEqual(segments, {
    overview: "",
    staff: "staff",
    roster: "roster",
    onboarding: "onboarding",
    compliance: "compliance",
    training: "training",
    identity: "identity",
  });
});

test("tab active-state matches its own href and not siblings", () => {
  const tenantBase = buildFiOsTeamTenantBase(TENANT);
  for (const tab of FI_OS_TEAM_TABS) {
    const href = buildFiOsTeamTabHref(TENANT, tab);
    assert.equal(isTeamTabActive(href, tenantBase, tab.segment), true, tab.id);
    for (const other of FI_OS_TEAM_TABS) {
      if (other.id === tab.id) continue;
      assert.equal(
        isTeamTabActive(href, tenantBase, other.segment),
        false,
        `${other.id} must not be active on ${tab.id}'s route`
      );
    }
  }
});

test("TeamSubNav renders seven real Link anchors with tenant-scoped hrefs", () => {
  const src = readFileSync(TEAM_SUB_NAV, "utf8");
  assert.ok(src.includes('import Link from "next/link"'));
  assert.ok(src.includes("buildFiOsTeamTabHref"));
  assert.ok(src.includes("buildFiOsTeamTenantBase"));
  assert.ok(src.includes("<Link"));
  assert.ok(src.includes("href={href}"));
  assert.ok(!src.includes("<button"), "tabs must not be buttons");
  assert.ok(!src.includes("preventDefault"), "tabs must not cancel navigation");
  assert.ok(!src.includes("pointer-events-none"), "tab nav must remain clickable");
  assert.ok(src.includes("pointer-events-auto"), "tab nav must explicitly accept clicks");
  assert.ok(src.includes("relative z-20"), "tab nav must sit above decorative overlays");
  assert.ok(src.includes("data-testid={`team-tab-${tab.id}`}"), "each tab exposes a test id");
  assert.ok(src.includes("FI_OS_TEAM_TABS"), "tabs come from FI_OS_TEAM_TABS");
  assert.ok(src.includes("tabs.map((tab"), "tabs render from FI_OS_TEAM_TABS map");
  assert.ok(src.includes("tab.id"), "tab ids drive keys and test ids");
  assert.ok(src.includes("tab.navSubItemId"), "tabs expose nav ids for pending strip");
});

test("team layout keeps sub-nav outside Suspense and provides page fallback", () => {
  const layout = readFileSync(TEAM_LAYOUT, "utf8");
  assert.ok(layout.includes("<TeamSubNav"));
  assert.ok(layout.includes("<Suspense fallback={<TeamWorkspacePageFallback />}"));
  assert.ok(!layout.includes("pointer-events-none"));

  const loading = readFileSync(TEAM_LOADING, "utf8");
  assert.ok(loading.includes("TeamWorkspacePageFallback"));

  const fallback = readFileSync(TEAM_FALLBACK, "utf8");
  assert.ok(fallback.includes('data-testid="team-workspace-page-loading"'));

  const template = readFileSync(TEAM_TEMPLATE, "utf8");
  assert.ok(template.includes("TeamWorkspaceTemplate"));
});
