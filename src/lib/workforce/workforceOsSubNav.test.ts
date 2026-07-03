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
    assert.match(roster.href, /\/hr-os\/roster$/);
  });

  it("buildWorkforceOsNavItems includes command centre and lifecycle modules", () => {
    const items = buildWorkforceOsNavItems(tenantId);
    assert.ok(items.some((i) => i.segment === ""));
    assert.ok(items.some((i) => i.segment === "planning"));
    assert.ok(items.some((i) => i.segment === "members"));
    assert.ok(items.some((i) => i.segment === "staff-access"));
    assert.equal(items.length, 11);
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

  it("isWorkforceOsNavActive highlights identity audit and roster routes", () => {
    assert.equal(
      isWorkforceOsNavActive(`${base}/staff-identity-audit`, base, "identity-audit"),
      true
    );
    assert.equal(
      isWorkforceOsNavActive(`/fi-admin/${tenantId}/hr-os/roster`, base, "roster"),
      true
    );
    assert.equal(
      isWorkforceOsNavActive(`/fi-admin/${tenantId}/hr-os/roster?eventId=1`, base, "roster"),
      true
    );
  });
});

describe("HrOsSubNav", () => {
  const tenantId = "tenant-1";

  it("includes Roster in HR OS navigation", () => {
    const items = buildHrOsNavItems(tenantId);
    const roster = items.find((i) => i.segment === "roster");
    assert.ok(roster);
    assert.equal(roster.label, STAFF_LIFECYCLE_LABELS.roster);
    assert.equal(roster.href, `/fi-admin/${tenantId}/hr-os/roster`);
  });
});

describe("staffLifecycleCopy nav integrity", () => {
  const tenantId = "tenant-1";
  const adminBase = `/fi-admin/${tenantId}`;

  it("Workforce Command Centre links point to the true command centre route", () => {
    assert.equal(buildWorkforceCommandCentreHref(tenantId), `${adminBase}/workforce-os`);
    const link = buildStaffLifecycleNavIntegrityLinks(tenantId).find(
      (l) => l.id === "workforce_command_centre"
    );
    assert.ok(link);
    assert.equal(link.href, `${adminBase}/workforce-os`);
    assert.equal(link.label, STAFF_LIFECYCLE_LABELS.workforceCommandCentre);
  });

  it("Staff Directory links point to the directory route", () => {
    assert.equal(buildStaffDirectoryHref(tenantId), `${adminBase}/staff`);
    const link = buildStaffLifecycleNavIntegrityLinks(tenantId).find(
      (l) => l.id === "staff_directory"
    );
    assert.ok(link);
    assert.equal(link.href, `${adminBase}/staff`);
  });

  it("Staff Access links point to Staff Access Centre", () => {
    assert.equal(
      buildStaffAccessCentreHref(adminBase),
      `${adminBase}/workforce-os/staff-access`
    );
    const link = buildStaffLifecycleNavIntegrityLinks(tenantId).find(
      (l) => l.id === "staff_access_centre"
    );
    assert.ok(link);
    assert.equal(link.href, `${adminBase}/workforce-os/staff-access`);
  });

  it("Onboarding links point to Onboarding Centre", () => {
    assert.equal(buildStaffOnboardingCentreHref(adminBase), `${adminBase}/hr-os/onboarding`);
    const link = buildStaffLifecycleNavIntegrityLinks(tenantId).find(
      (l) => l.id === "onboarding_centre"
    );
    assert.ok(link);
    assert.equal(link.href, `${adminBase}/hr-os/onboarding`);
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

describe("WorkforceCommandCentreView deprecation", () => {
  it("legacy view module remains importable for Phase 4 reference", async () => {
    const mod = await import("@/src/components/fi/staff/WorkforceCommandCentreView");
    assert.equal(typeof mod.WorkforceCommandCentreView, "function");
  });
});
