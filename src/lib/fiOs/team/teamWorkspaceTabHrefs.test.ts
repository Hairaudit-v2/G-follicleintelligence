import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  FI_OS_TEAM_TABS,
  buildFiOsTeamBase,
  buildFiOsTeamTabHref,
  isTeamTabActive,
} from "@/src/lib/fiOs/team/teamWorkspaceCore";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEAM_SUB_NAV = "src/components/fi-os/team/TeamSubNav.tsx";

test("every team workspace tab builds a non-empty tenant-scoped href", () => {
  const base = buildFiOsTeamBase(TENANT);
  assert.equal(base, `/fi-admin/${TENANT}/team`);

  const hrefs = FI_OS_TEAM_TABS.map((tab) => buildFiOsTeamTabHref(TENANT, tab));
  for (const href of hrefs) {
    assert.ok(href.startsWith(base), `href must live under the team base: ${href}`);
    assert.ok(!href.includes("//"), `href must not contain empty segments: ${href}`);
  }
  // Hrefs must be unique — two tabs pointing at the same route means a dead tab.
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
  const base = `/fi-admin/${TENANT}`;
  for (const tab of FI_OS_TEAM_TABS) {
    const href = buildFiOsTeamTabHref(TENANT, tab);
    assert.equal(isTeamTabActive(href, base, tab.segment), true, tab.id);
    for (const other of FI_OS_TEAM_TABS) {
      if (other.id === tab.id) continue;
      // Overview ("") is a prefix of everything; only exact match counts for it.
      assert.equal(
        isTeamTabActive(href, base, other.segment),
        false,
        `${other.id} must not be active on ${tab.id}'s route`
      );
    }
  }
});

test("TeamSubNav renders real Link elements with tab hrefs (no button-only tabs)", () => {
  const src = readFileSync(TEAM_SUB_NAV, "utf8");
  assert.ok(src.includes('import Link from "next/link"'));
  assert.ok(src.includes("buildFiOsTeamTabHref"));
  assert.ok(src.includes("<Link"));
  assert.ok(src.includes("href={href}"));
  // Guard against the nav being re-implemented with dead click handlers.
  assert.ok(!src.includes("onClick"), "TeamSubNav tabs must navigate via hrefs, not onClick");
  // Decorative overlays must never sit above the nav intercepting clicks.
  assert.ok(!src.includes("pointer-events-auto"));
});
