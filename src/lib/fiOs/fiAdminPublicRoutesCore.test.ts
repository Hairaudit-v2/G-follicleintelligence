import assert from "node:assert/strict";
import test from "node:test";

import {
  isFiAdminPublicSubpath,
  isFiAdminTokenPublicRoute,
} from "@/src/lib/fiOs/fiAdminPublicRoutesCore";

test("isFiAdminTokenPublicRoute includes onboarding and staff-access token routes", () => {
  assert.equal(
    isFiAdminTokenPublicRoute("/fi-admin/t-1/onboarding/invite/abc-123"),
    true
  );
  assert.equal(
    isFiAdminTokenPublicRoute("/fi-admin/t-1/workforce-os/staff-access/accept/abc-123"),
    true
  );
  assert.equal(
    isFiAdminTokenPublicRoute("/fi-admin/t-1/workforce-os/staff-access/pin-setup/abc-123"),
    true
  );
  assert.equal(isFiAdminTokenPublicRoute("/fi-admin/t-1/hr-os/onboarding"), false);
});

test("isFiAdminPublicSubpath includes token routes and staff pin login", () => {
  assert.equal(isFiAdminPublicSubpath("/fi-admin/t-1/onboarding/invite/token"), true);
  assert.equal(isFiAdminPublicSubpath("/fi-admin/t-1/staff-pin-login"), true);
  assert.equal(isFiAdminPublicSubpath("/fi-admin/t-1/calendar"), false);
});
