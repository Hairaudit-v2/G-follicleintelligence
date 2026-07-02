import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStaffIdentityReadinessAuditRowForTest,
  summarizeStaffTestingReadiness,
  type StaffIdentityReadinessAuditRow,
} from "./staffIdentityReadinessAudit.server";

const MEMBER_ID = "11111111-1111-1111-1111-111111111111";

function baseMember() {
  return {
    id: MEMBER_ID,
    full_name: "Alex Staff",
    email: "alex@example.com",
    role_code: "nurse",
    employment_status: "active",
    fi_staff_id: "22222222-2222-2222-2222-222222222222",
    archived_at: null,
    system_access_revoked: false,
  };
}

function baseFiStaff() {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    fi_user_id: "33333333-3333-3333-3333-333333333333",
    email: "alex@example.com",
    staff_role: "nurse",
    staff_metadata: null,
    position_type_id: null,
    is_active: true,
  };
}

function buildRow(
  overrides: Partial<Parameters<typeof buildStaffIdentityReadinessAuditRowForTest>[0]> = {}
): StaffIdentityReadinessAuditRow {
  return buildStaffIdentityReadinessAuditRowForTest({
    member: baseMember(),
    fiStaff: baseFiStaff(),
    fiUserId: "33333333-3333-3333-3333-333333333333",
    authUserId: "44444444-4444-4444-4444-444444444444",
    authSnapshot: { exists: true, emailConfirmed: true, hasSignedIn: true },
    inviteStatus: "none",
    pinRawStatus: "active",
    positionDefaultProfile: "nurse",
    templateDefaultProfile: null,
    featureAccessCount: 2,
    checklistPending: false,
    ...overrides,
  });
}

describe("buildStaffIdentityReadinessAuditRowForTest", () => {
  it("flags staff missing fi_user link", () => {
    const row = buildRow({
      fiUserId: null,
      authUserId: null,
      authSnapshot: null,
      fiStaff: { ...baseFiStaff(), fi_user_id: null },
    });
    assert.equal(row.loginStatus, "missing_user");
    assert.ok(row.issues.some((i) => i.includes("fi_user")));
  });

  it("flags staff missing workspace profile when no signals exist", () => {
    const row = buildRow({
      fiStaff: { ...baseFiStaff(), staff_role: null },
      positionDefaultProfile: null,
      templateDefaultProfile: null,
      member: { ...baseMember(), role_code: null },
    });
    assert.equal(row.workspaceProfileStatus, "missing");
  });

  it("marks suspended staff as not ready for login", () => {
    const row = buildRow({
      member: { ...baseMember(), employment_status: "suspended" },
    });
    assert.equal(row.loginStatus, "suspended");
    assert.equal(row.onboardingStatus, "blocked");
  });

  it("marks pending invite as invited login status", () => {
    const row = buildRow({
      authSnapshot: { exists: true, emailConfirmed: false, hasSignedIn: false },
      inviteStatus: "pending",
    });
    assert.equal(row.loginStatus, "invited");
    assert.ok(row.issues.some((i) => i.toLowerCase().includes("invitation")));
  });
});

describe("summarizeStaffTestingReadiness", () => {
  it("blocks staff UAT when identity chain is incomplete", () => {
    const rows = [
      buildRow(),
      buildRow({
        member: { ...baseMember(), id: "55555555-5555-5555-5555-555555555555" },
        fiUserId: null,
        authUserId: null,
        authSnapshot: null,
        fiStaff: { ...baseFiStaff(), fi_user_id: null },
      }),
    ];
    assert.equal(summarizeStaffTestingReadiness(rows), "blocked");
  });

  it("returns watch when only PIN or invite cleanup remains", () => {
    const rows = [
      buildRow({
        pinRawStatus: "not_set",
      }),
    ];
    assert.equal(summarizeStaffTestingReadiness(rows), "watch");
  });

  it("returns watch for pending invite without blocking issues", () => {
    const rows = [
      buildRow({
        authSnapshot: { exists: true, emailConfirmed: false, hasSignedIn: false },
        inviteStatus: "pending",
      }),
    ];
    assert.equal(summarizeStaffTestingReadiness(rows), "watch");
  });

  it("returns ready when all active staff have login and profile pathways", () => {
    const rows = [buildRow()];
    assert.equal(summarizeStaffTestingReadiness(rows), "ready");
  });

  it("blocks when workspace profile is missing for active staff", () => {
    const rows = [
      buildRow({
        fiStaff: { ...baseFiStaff(), staff_role: null },
        positionDefaultProfile: null,
        templateDefaultProfile: null,
        member: { ...baseMember(), role_code: null },
      }),
    ];
    assert.equal(summarizeStaffTestingReadiness(rows), "blocked");
  });
});
