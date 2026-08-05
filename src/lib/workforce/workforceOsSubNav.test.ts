import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWorkforceOsNavItems,
  isWorkforceOsNavActive,
} from "@/src/components/fi/workforce/WorkforceOsSubNav";
import { buildHrOsNavItems } from "@/src/components/fi/hr-os/HrOsSubNav";
import {
  buildStaffDirectoryHref,
  buildStaffEntitlementsHref,
  buildStaffIdentityAuditHref,
  buildStaffLifecycleNavIntegrityLinks,
  buildWorkforceCommandCentreHref,
  buildWorkforceRosterHref,
  STAFF_LIFECYCLE_LABELS,
} from "@/src/lib/workforce/staffLifecycleCopy";
import {
  buildStaffAccessCentreHref,
  buildStaffOnboardingCentreHref,
} from "@/src/lib/workforce/staffLifecycleUxCore";

describe("WorkforceOsSubNav", () => {
  const tenantId = "tenant-1";
  const base = `/fi-admin/${tenantId}/workforce-os`;

  it("includes Identity Audit and Roster in WorkforceOS navigation", () => {
    const items = buildWorkforceOsNavItems(tenantId);
    const identityAudit = items.find((i) => i.segment === "identity-audit");
    const roster = items.find((i) => i.segment === "roster");

    assert.ok(identityAudit);
    assert.equal(identityAudit.label, STAFF_LIFECYCLE_LABELS.identityAudit);
    assert.equal(identityAudit.href, buildStaffIdentityAuditHref(tenantId));
    assert.match(identityAudit.title ?? "", /identity, login, PIN/i);

    assert.ok(roster);
    assert.equal(roster.label, STAFF_LIFECYCLE_LABELS.roster);
    assert.equal(roster.href, buildWorkforceRosterHref(tenantId));
    // A2: /team/roster is the only roster route.
    assert.match(roster.href, /\/team\/roster$/);
  });

  it("buildWorkforceOsNavItems includes command centre and lifecycle modules", () => {
    const items = buildWorkforceOsNavItems(tenantId);
    assert.ok(items.some((i) => i.segment === ""));
    assert.ok(items.some((i) => i.segment === "planning"));
    assert.ok(items.some((i) => i.segment === "members"));
    assert.ok(items.some((i) => i.segment === "staff-access"));
    assert.equal(items.length, 11);
  });

  it("hides Identity Audit nav item when showIdentityAudit is false", () => {
    const items = buildWorkforceOsNavItems(tenantId, { showIdentityAudit: false });
    assert.equal(
      items.some((i) => i.segment === "identity-audit"),
      false
    );
    assert.equal(items.length, 10);
  });

  it("isWorkforceOsNavActive matches command centre exactly", () => {
    assert.equal(isWorkforceOsNavActive(base, base, ""), true);
    assert.equal(isWorkforceOsNavActive(`${base}/`, base, ""), true);
    assert.equal(isWorkforceOsNavActive(`${base}/planning`, base, ""), false);
  });

  it("isWorkforceOsNavActive highlights members for directory and staff profile", () => {
    assert.equal(isWorkforceOsNavActive(`${base}/directory`, base, "members"), true);
    assert.equal(isWorkforceOsNavActive(`${base}/staff/abc-123`, base, "members"), true);
    assert.equal(isWorkforceOsNavActive(`${base}/recruitment`, base, "members"), false);
  });

  // A2: identity audit and roster moved out of /workforce-os, so the nav
  // highlights them at their canonical /team locations.
  it("isWorkforceOsNavActive highlights identity audit and roster at canonical routes", () => {
    assert.equal(
      isWorkforceOsNavActive(
        `/fi-admin/${tenantId}/team/admin/identity-audit`,
        base,
        "identity-audit"
      ),
      true
    );
    assert.equal(isWorkforceOsNavActive(`/fi-admin/${tenantId}/team/roster`, base, "roster"), true);
    assert.equal(
      isWorkforceOsNavActive(`/fi-admin/${tenantId}/team/roster?eventId=1`, base, "roster"),
      true
    );
    // The retired paths no longer render, so they never highlight.
    assert.equal(
      isWorkforceOsNavActive(`${base}/staff-identity-audit`, base, "identity-audit"),
      false
    );
  });
});

describe("HrOsSubNav", () => {
  const tenantId = "tenant-1";

  it("links Roster out to the canonical Team route after A2", () => {
    const items = buildHrOsNavItems(tenantId);
    const roster = items.find((i) => i.segment === "team-roster");
    assert.ok(roster);
    assert.equal(roster.label, STAFF_LIFECYCLE_LABELS.roster);
    assert.equal(roster.href, `/fi-admin/${tenantId}/team/roster`);
    // The retired /hr-os/roster entry is gone from this nav entirely.
    assert.equal(
      items.find((i) => i.href === `/fi-admin/${tenantId}/hr-os/roster`),
      undefined
    );
  });
});

describe("staffLifecycleCopy nav integrity", () => {
  const tenantId = "tenant-1";
  const adminBase = `/fi-admin/${tenantId}`;

  // A2: every lifecycle nav link points at its canonical /team destination, so
  // the app never navigates through a redirect.
  it("Workforce Command Centre links point to the Team overview", () => {
    assert.equal(buildWorkforceCommandCentreHref(tenantId), `${adminBase}/team`);
    const link = buildStaffLifecycleNavIntegrityLinks(tenantId).find(
      (l) => l.id === "workforce_command_centre"
    );
    assert.ok(link);
    assert.equal(link.href, `${adminBase}/team`);
    assert.equal(link.label, STAFF_LIFECYCLE_LABELS.workforceCommandCentre);
  });

  it("Staff Directory links point to the Team staff tab", () => {
    assert.equal(buildStaffDirectoryHref(tenantId), `${adminBase}/team/staff`);
    const link = buildStaffLifecycleNavIntegrityLinks(tenantId).find(
      (l) => l.id === "staff_directory"
    );
    assert.ok(link);
    assert.equal(link.href, `${adminBase}/team/staff`);
  });

  it("Staff Access links point to the Team identity tab", () => {
    assert.equal(buildStaffAccessCentreHref(adminBase), `${adminBase}/team/identity`);
    const link = buildStaffLifecycleNavIntegrityLinks(tenantId).find(
      (l) => l.id === "staff_access_centre"
    );
    assert.ok(link);
    assert.equal(link.href, `${adminBase}/team/identity`);
  });

  it("Onboarding links point to the Team onboarding tab", () => {
    assert.equal(buildStaffOnboardingCentreHref(adminBase), `${adminBase}/team/onboarding`);
    const link = buildStaffLifecycleNavIntegrityLinks(tenantId).find(
      (l) => l.id === "onboarding_centre"
    );
    assert.ok(link);
    assert.equal(link.href, `${adminBase}/team/onboarding`);
  });

  it("settings staff label no longer conflicts with Staff Access wording", () => {
    assert.equal(buildStaffEntitlementsHref(tenantId), `${adminBase}/settings/staff-access`);
    const entitlements = buildStaffLifecycleNavIntegrityLinks(tenantId).find(
      (l) => l.id === "staff_entitlements"
    );
    assert.ok(entitlements);
    assert.equal(entitlements.label, STAFF_LIFECYCLE_LABELS.staffEntitlements);
    assert.doesNotMatch(entitlements.label, /Staff Access Centre/i);
    assert.notEqual(entitlements.href, `${adminBase}/workforce-os/staff-access`);
  });
});

// A2: the orphaned WorkforceCommandCentreView was deleted. It was never mounted
// and carried dead "Add staff" / "Assign training" actions plus links to routes
// that have since retired. The live surface is WorkforceCommandCentreClient.
