import assert from "node:assert/strict";
import test from "node:test";

import { isFiAdminTokenPublicRoute } from "@/src/lib/fiOs/fiAdminPublicRoutesCore";
import {
  TEAM_LEGACY_REDIRECTS,
  TEAM_PRESERVED_LEGACY_ROUTES,
  buildLegacyRedirectQuery,
  resolveTeamLegacyRedirectHref,
  resolveTeamLegacyRedirectSuffix,
  teamLegacySuffixForPath,
  teamLegacyRedirectHrefForSuffix,
} from "@/src/lib/fiOs/team/teamLegacyRedirects";

const tenantId = "t-a2-1";
const base = `/fi-admin/${tenantId}`;

test("A2 contract: every retired route redirects to its documented canonical target", () => {
  const expected: Record<string, string> = {
    staff: "team/staff",
    "workforce-os": "team",
    "workforce-os/roster": "team/roster",
    "hr-os/roster": "team/roster",
    "hr-os/onboarding": "team/onboarding",
    "hr-os/compliance": "team/compliance",
    "hr-os/certifications": "team/training",
    "workforce-os/staff-access": "team/identity",
    "workforce-os/staff-identity-audit": "team/admin/identity-audit",
    "workforce-os/hr-task-map": "team/admin/access-task-map",
    "hr-os/sync-health": "team/admin/sync-health",
  };

  // The map and this table must agree in both directions — a new entry without a
  // documented target (or vice versa) fails here rather than shipping silently.
  assert.deepEqual(
    TEAM_LEGACY_REDIRECTS.map((r) => r.from).sort(),
    Object.keys(expected).sort()
  );

  for (const [from, to] of Object.entries(expected)) {
    assert.equal(
      resolveTeamLegacyRedirectHref(`${base}/${from}`, base),
      `${base}/${to}`,
      `${from} must redirect to ${to}`
    );
    assert.equal(teamLegacyRedirectHrefForSuffix(from, base), `${base}/${to}`);
  }
});

test("A2 contract: every redirect target is canonical — under /team and never itself retired", () => {
  const sources = new Set(TEAM_LEGACY_REDIRECTS.map((r) => r.from));
  for (const entry of TEAM_LEGACY_REDIRECTS) {
    assert.ok(
      entry.to === "team" || entry.to.startsWith("team/"),
      `${entry.to} must live under the canonical /team prefix`
    );
    assert.ok(!sources.has(entry.to), `${entry.to} must not itself be a retired route (no chains)`);
    assert.equal(
      resolveTeamLegacyRedirectSuffix(`${base}/${entry.to}`, base),
      null,
      `${entry.to} must render, not redirect`
    );
    assert.ok(entry.basis.trim().length > 0, `${entry.from} must document why the target matches`);
  }
});

test("A2 contract: query strings survive the redirect", () => {
  // Staff directory filters.
  assert.equal(
    resolveTeamLegacyRedirectHref(`${base}/staff`, base, "staff_role=nurse&active=true"),
    `${base}/team/staff?staff_role=nurse&active=true`
  );
  // Roster filters, including a preselected event deep link.
  assert.equal(
    resolveTeamLegacyRedirectHref(
      `${base}/workforce-os/roster`,
      base,
      "periodStart=2026-08-03&clinicId=c-1&eventId=e-9"
    ),
    `${base}/team/roster?periodStart=2026-08-03&clinicId=c-1&eventId=e-9`
  );
  // Access task map deep link.
  assert.equal(
    teamLegacyRedirectHrefForSuffix("workforce-os/hr-task-map", base, "staffId=s-1&task=reset_pin"),
    `${base}/team/admin/access-task-map?staffId=s-1&task=reset_pin`
  );
  // A leading "?" is tolerated, and an empty query adds no separator.
  assert.equal(
    resolveTeamLegacyRedirectHref(`${base}/staff`, base, "?active=true"),
    `${base}/team/staff?active=true`
  );
  assert.equal(resolveTeamLegacyRedirectHref(`${base}/staff`, base, ""), `${base}/team/staff`);
});

test("buildLegacyRedirectQuery serializes Next.js searchParams and drops empties", () => {
  assert.equal(
    buildLegacyRedirectQuery({ staff_role: "nurse", active: "true", payroll: undefined, blank: "" }),
    "staff_role=nurse&active=true"
  );
  assert.equal(buildLegacyRedirectQuery({ tag: ["a", "b"] }), "tag=a&tag=b");
  assert.equal(buildLegacyRedirectQuery({}), "");
});

test("A2 contract: matching is exact — children of retired routes keep rendering", () => {
  const mustNotRedirect = [
    // Retired index pages whose children are separate live routes.
    `${base}/staff/link-users`,
    `${base}/staff/role-review`,
    `${base}/staff/some-staff-id/twin`,
    `${base}/workforce-os/payroll`,
    `${base}/workforce-os/planning`,
    `${base}/workforce-os/directory`,
    `${base}/workforce-os/staff/staff-id-1`,
    `${base}/workforce-os/roster/standard-hours`,
    `${base}/workforce-os/roster/standard-hours/staff-id-1`,
    `${base}/hr-os/credentials`,
    `${base}/hr-os/offboarding`,
    // Never a legacy route at all.
    `${base}/team/roster`,
    `${base}/calendar`,
  ];
  for (const path of mustNotRedirect) {
    assert.equal(resolveTeamLegacyRedirectSuffix(path, base), null, `${path} must keep rendering`);
  }
});

test("A2 contract: token-authenticated routes are never redirected", () => {
  const tokenPaths = [
    `${base}/workforce-os/staff-access/accept/tok-123`,
    `${base}/workforce-os/staff-access/pin-setup/setup-456`,
    `${base}/onboarding/invite/tok-789`,
  ];
  for (const path of tokenPaths) {
    assert.ok(isFiAdminTokenPublicRoute(path), `${path} must stay token-public`);
    assert.equal(
      resolveTeamLegacyRedirectSuffix(path, base),
      null,
      `${path} must never redirect — invitees follow these links without a session`
    );
  }

  // The retired /workforce-os/staff-access index sits directly above these
  // routes, so guard the exact boundary that a prefix match would break.
  assert.equal(
    resolveTeamLegacyRedirectSuffix(`${base}/workforce-os/staff-access`, base),
    "team/identity"
  );
  assert.equal(
    resolveTeamLegacyRedirectSuffix(`${base}/workforce-os/staff-access/accept/abc`, base),
    null
  );
});

test("A2 contract: documented preserved routes still render", () => {
  for (const preserved of TEAM_PRESERVED_LEGACY_ROUTES) {
    assert.equal(
      resolveTeamLegacyRedirectSuffix(`${base}/${preserved.suffix}`, base),
      null,
      `${preserved.suffix} is documented as preserved and must not redirect`
    );
    assert.ok(preserved.reason.trim().length > 0);
  }
});

test("trailing slashes, query strings, and foreign paths are handled", () => {
  assert.equal(resolveTeamLegacyRedirectSuffix(`${base}/staff/`, base), "team/staff");
  assert.equal(resolveTeamLegacyRedirectSuffix(`${base}/staff?active=true`, base), "team/staff");
  assert.equal(resolveTeamLegacyRedirectSuffix(`${base}/staff#frag`, base), "team/staff");
  assert.equal(resolveTeamLegacyRedirectSuffix("/fi-admin/other-tenant/staff", base), null);
  assert.equal(resolveTeamLegacyRedirectSuffix("/some/other/app/staff", base), null);
  assert.equal(teamLegacySuffixForPath(base, base), "");
  assert.equal(teamLegacySuffixForPath("/elsewhere", base), null);
});
