import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStaffStandardHoursEditorHref,
  buildStaffStandardHoursReturnToRosterHref,
  buildStaffStandardHoursSetupIndexHref,
} from "./staffStandardHoursRoutes";

const TENANT = "11111111-1111-4111-8111-111111111111";
const STAFF = "22222222-2222-4222-8222-222222222222";

test("buildStaffStandardHoursSetupIndexHref points at workforce-os roster standard-hours index", () => {
  assert.equal(
    buildStaffStandardHoursSetupIndexHref(TENANT),
    `/fi-admin/${TENANT}/workforce-os/roster/standard-hours`
  );
});

test("buildStaffStandardHoursEditorHref encodes optional returnTo query", () => {
  assert.equal(
    buildStaffStandardHoursEditorHref(TENANT, STAFF),
    `/fi-admin/${TENANT}/workforce-os/roster/standard-hours/${STAFF}`
  );
  assert.equal(
    buildStaffStandardHoursEditorHref(TENANT, STAFF, {
      returnTo: `/fi-admin/${TENANT}/workforce-os/roster`,
    }),
    `/fi-admin/${TENANT}/workforce-os/roster/standard-hours/${STAFF}?returnTo=%2Ffi-admin%2F${TENANT}%2Fworkforce-os%2Froster`
  );
});

test("buildStaffStandardHoursReturnToRosterHref points at roster command centre", () => {
  assert.equal(
    buildStaffStandardHoursReturnToRosterHref(TENANT),
    `/fi-admin/${TENANT}/workforce-os/roster`
  );
});
