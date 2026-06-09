import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canUseStaffPinClinicSession,
  isStaffPinRestrictedRoute,
  type StaffPinClinicSession,
} from "./staffPinPermissions";

const session: StaffPinClinicSession = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  staffId: "22222222-2222-4222-8222-222222222222",
  staffName: "Alex Nurse",
  staffRole: "nurse",
  sessionToken: "33333333-3333-4333-8333-333333333333",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

describe("staffPinPermissions", () => {
  it("allows clinic-floor actions", () => {
    assert.equal(canUseStaffPinClinicSession(session, "calendar.view"), true);
    assert.equal(canUseStaffPinClinicSession(session, "calendar.quick_book"), true);
    assert.equal(canUseStaffPinClinicSession(session, "patient.check_in"), true);
  });

  it("blocks admin and settings actions", () => {
    assert.equal(canUseStaffPinClinicSession(session, "settings.any"), false);
    assert.equal(canUseStaffPinClinicSession(session, "staff.manage"), false);
    assert.equal(canUseStaffPinClinicSession(session, "prescriptions.send"), false);
    assert.equal(canUseStaffPinClinicSession(session, "data.export"), false);
  });

  it("rejects expired sessions", () => {
    const expired = { ...session, expiresAt: "2020-01-01T00:00:00.000Z" };
    assert.equal(canUseStaffPinClinicSession(expired, "calendar.view"), false);
  });

  it("flags restricted routes for PIN sessions", () => {
    const base = `/fi-admin/${session.tenantId}`;
    assert.equal(isStaffPinRestrictedRoute(`${base}/calendar`, base), false);
    assert.equal(isStaffPinRestrictedRoute(`${base}/patients`, base), false);
    assert.equal(isStaffPinRestrictedRoute(`${base}/settings/admin-users`, base), true);
    assert.equal(isStaffPinRestrictedRoute(`${base}/prescriptions`, base), true);
    assert.equal(isStaffPinRestrictedRoute(`${base}/staff`, base), true);
  });
});
