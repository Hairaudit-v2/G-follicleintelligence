import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertStaffPinMutationDecision,
  evaluateStaffPinMutationAccess,
  StaffPinMutationBlockedError,
  STAFF_PIN_RESTRICTED_MUTATION_MESSAGE,
} from "./staffPinMutationGuard";
import type { StaffPinClinicSession } from "./staffPinPermissions";

const tenantId = "11111111-1111-4111-8111-111111111111";
const staffId = "22222222-2222-4222-8222-222222222222";

function activePinSession(): StaffPinClinicSession {
  return {
    tenantId,
    staffId,
    staffName: "Floor Nurse",
    staffRole: "nurse",
    sessionToken: "33333333-3333-4333-8333-333333333333",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

describe("evaluateStaffPinMutationAccess", () => {
  it("allows normal mutations when no PIN session is active", () => {
    const decision = evaluateStaffPinMutationAccess(null, "settings.any");
    if ("blocked" in decision) {
      assert.fail("expected allowed");
    }
    assert.equal(decision.via, "no_pin_session");
  });

  it("blocks services pricing mutations under PIN session", () => {
    assert.throws(
      () =>
        assertStaffPinMutationDecision(
          evaluateStaffPinMutationAccess(activePinSession(), "services.pricing")
        ),
      (e: unknown) => {
        assert.ok(e instanceof StaffPinMutationBlockedError);
        assert.equal(e.message, STAFF_PIN_RESTRICTED_MUTATION_MESSAGE);
        return true;
      }
    );
  });

  it("blocks staff management under PIN session", () => {
    assert.throws(
      () =>
        assertStaffPinMutationDecision(
          evaluateStaffPinMutationAccess(activePinSession(), "staff.manage")
        ),
      StaffPinMutationBlockedError
    );
  });

  it("blocks tax settings under PIN session", () => {
    assert.throws(
      () =>
        assertStaffPinMutationDecision(
          evaluateStaffPinMutationAccess(activePinSession(), "tax.settings")
        ),
      StaffPinMutationBlockedError
    );
  });

  it("blocks prescribing and pharmacy send under PIN session", () => {
    for (const action of ["prescriptions.send", "data.export", "records.delete"] as const) {
      assert.throws(
        () =>
          assertStaffPinMutationDecision(
            evaluateStaffPinMutationAccess(activePinSession(), action)
          ),
        StaffPinMutationBlockedError
      );
    }
  });

  it("blocks restricted mutations when PIN session is active without a floor action", () => {
    assert.throws(
      () => assertStaffPinMutationDecision(evaluateStaffPinMutationAccess(activePinSession())),
      StaffPinMutationBlockedError
    );
  });

  it("allows basic booking creation under PIN session", () => {
    const decision = evaluateStaffPinMutationAccess(activePinSession(), "calendar.quick_book");
    if ("blocked" in decision) {
      assert.fail("expected allowed");
    }
    assert.equal(decision.via, "staff_pin_floor");
    if (decision.via === "staff_pin_floor") {
      assert.equal(decision.staffId, staffId);
    }
  });

  it("allows patient check-in under PIN session", () => {
    const decision = evaluateStaffPinMutationAccess(activePinSession(), "patient.check_in");
    if ("blocked" in decision) {
      assert.fail("expected allowed");
    }
    assert.equal(decision.via, "staff_pin_floor");
  });

  it("does not expose internal permission details in blocked error", () => {
    try {
      assertStaffPinMutationDecision(
        evaluateStaffPinMutationAccess(activePinSession(), "admin.dashboard")
      );
      assert.fail("expected block");
    } catch (e: unknown) {
      assert.ok(e instanceof StaffPinMutationBlockedError);
      assert.equal(e.message, "This action requires full admin login.");
      assert.equal(e.message.includes("staff_pin"), false);
      assert.equal(e.message.includes("permission"), false);
    }
  });
});
