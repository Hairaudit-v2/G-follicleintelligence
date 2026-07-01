import assert from "node:assert/strict";
import test from "node:test";

import { getFiOsShellActiveSidebarId, resolveFiOsPrimarySidebarItems } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import { buildOnboardingInviteUrl } from "@/src/lib/workforce/onboarding/onboardingInviteUrlCore";

const base = "/fi-admin/t-1";

test("resolveFiOsPrimarySidebarItems: includes Onboarding Centre when HR OS nav visible", () => {
  const items = resolveFiOsPrimarySidebarItems(base, true, true, null, true, true, false, true);
  const onboarding = items.find((i) => i.id === "onboarding-centre");
  assert.ok(onboarding);
  assert.equal(onboarding?.href, `${base}/hr-os/onboarding`);
  assert.equal(onboarding?.disabled, false);
});

test("getFiOsShellActiveSidebarId: hr-os onboarding maps to onboarding-centre sidebar tab", () => {
  assert.equal(
    getFiOsShellActiveSidebarId(`${base}/hr-os/onboarding`, base),
    "onboarding-centre"
  );
  assert.equal(getFiOsShellActiveSidebarId(`${base}/hr-os/offboarding`, base), "hr-os");
});

test("buildOnboardingInviteUrl: builds tenant-scoped invite path", () => {
  const url = buildOnboardingInviteUrl("t-1", "abc-123");
  assert.ok(url.includes("/fi-admin/t-1/onboarding/invite/abc-123"));
});
