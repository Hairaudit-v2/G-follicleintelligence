import assert from "node:assert/strict";
import test from "node:test";

import {
  getFiOsShellActiveSidebarId,
  resolveFiOsPrimarySidebarItems,
} from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { buildOnboardingInviteUrl } from "@/src/lib/workforce/onboarding/onboardingInviteUrlCore";

const base = "/fi-admin/t-1";

function withEnv(patch: Record<string, string | undefined>, fn: () => void): void {
  const prev = new Map<string, string | undefined>();
  for (const key of Object.keys(patch)) {
    prev.set(key, process.env[key]);
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of prev) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("resolveFiOsPrimarySidebarItems: includes onboarding tab when HR OS nav visible", () => {
  const items = resolveFiOsPrimarySidebarItems(base, true, true, null, true, true, false, true);
  const team = items.find((i) => i.id === "team");
  assert.ok(team);
  const onboarding = team?.subItems?.find((s) => s.id === "team-onboarding");
  assert.ok(onboarding);
  assert.equal(onboarding?.href, `${base}/team/onboarding`);
  // A1 removed the legacy "(direct)" duplicate from the nav catalog.
  assert.equal(
    team?.subItems?.find((s) => s.id === "onboarding-centre"),
    undefined
  );
});

test("getFiOsShellActiveSidebarId: workforce surfaces all highlight the Team nav entry", () => {
  // A2: /hr-os/onboarding redirects to /team/onboarding; /hr-os/offboarding still
  // renders. Both belong to the Team workspace, so both highlight the same entry.
  assert.equal(getFiOsShellActiveSidebarId(`${base}/hr-os/onboarding`, base), "team");
  assert.equal(getFiOsShellActiveSidebarId(`${base}/hr-os/offboarding`, base), "team");
});

test("buildOnboardingInviteUrl: builds tenant-scoped invite path on canonical public URL", () => {
  withEnv(
    {
      FI_PUBLIC_APP_URL: "https://app.follicleintelligence.com",
      VERCEL_URL: "g-follicleintelligence-k84zti7pp.vercel.app",
    },
    () => {
      const url = buildOnboardingInviteUrl("t-1", "abc-123");
      assert.equal(
        url,
        "https://app.follicleintelligence.com/fi-admin/t-1/onboarding/invite/abc-123"
      );
      assert.doesNotMatch(url, /\.vercel\.app/);
    }
  );
});
