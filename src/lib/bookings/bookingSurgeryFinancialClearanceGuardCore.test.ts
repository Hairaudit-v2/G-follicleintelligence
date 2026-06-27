import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSurgeryBookingConfirmationTransition,
  isSurgeryWithinClearanceWindow,
  shouldBlockSurgeryConfirmationForFinancialClearance,
  surgeryConfirmationFinancialClearanceBlockedMessage,
  SURGERY_CONFIRMATION_FINANCIAL_CLEARANCE_BLOCKED_PREFIX,
} from "@/src/lib/bookings/bookingSurgeryFinancialClearanceGuardCore";

const TZ = "Australia/Perth";
const TODAY = "2026-06-16";
const WINDOW_END = "2026-06-29";

function windowCtx(surgeryStartAtIso: string) {
  return {
    bookingType: "surgery",
    previousBookingStatus: "scheduled",
    nextBookingStatus: "confirmed",
    surgeryStartAtIso,
    calendarTimezone: TZ,
    todayYmd: TODAY,
    windowEndYmd: WINDOW_END,
  };
}

describe("bookingSurgeryFinancialClearanceGuardCore", () => {
  it("detects surgery confirmation transition only", () => {
    assert.equal(
      isSurgeryBookingConfirmationTransition({
        bookingType: "surgery",
        previousBookingStatus: "scheduled",
        nextBookingStatus: "confirmed",
      }),
      true
    );
    assert.equal(
      isSurgeryBookingConfirmationTransition({
        bookingType: "consultation",
        previousBookingStatus: "scheduled",
        nextBookingStatus: "confirmed",
      }),
      false
    );
    assert.equal(
      isSurgeryBookingConfirmationTransition({
        bookingType: "surgery",
        previousBookingStatus: "confirmed",
        nextBookingStatus: "confirmed",
      }),
      false
    );
    assert.equal(
      isSurgeryBookingConfirmationTransition({
        bookingType: "surgery",
        previousBookingStatus: "scheduled",
        nextBookingStatus: "arrived",
      }),
      false
    );
  });

  it("treats surgery within tenant 14-day window inclusively", () => {
    assert.equal(isSurgeryWithinClearanceWindow(windowCtx("2026-06-16T01:00:00.000Z")), true);
    assert.equal(isSurgeryWithinClearanceWindow(windowCtx("2026-06-29T10:00:00.000Z")), true);
    assert.equal(isSurgeryWithinClearanceWindow(windowCtx("2026-07-01T01:00:00.000Z")), false);
  });

  it("blocks only explicit not_ready within clearance window", () => {
    assert.equal(
      shouldBlockSurgeryConfirmationForFinancialClearance(
        { clearance_state: "not_ready", clearance_reason: "Deposit not collected", next_required_action: "Collect surgery deposit" },
        true
      ),
      true
    );
    assert.equal(
      shouldBlockSurgeryConfirmationForFinancialClearance(
        { clearance_state: "unavailable", clearance_reason: "No data", next_required_action: null },
        true
      ),
      false
    );
    assert.equal(
      shouldBlockSurgeryConfirmationForFinancialClearance(
        { clearance_state: "attention_required", clearance_reason: "Balance overdue", next_required_action: "Collect balance" },
        true
      ),
      false
    );
    assert.equal(
      shouldBlockSurgeryConfirmationForFinancialClearance(
        { clearance_state: "not_ready", clearance_reason: "Deposit not collected", next_required_action: null },
        false
      ),
      false
    );
  });

  it("returns operational blocked message", () => {
    const msg = surgeryConfirmationFinancialClearanceBlockedMessage({
      clearance_reason: "Deposit not collected; No payment pathway selected",
      next_required_action: "Collect surgery deposit",
    });
    assert.ok(msg.startsWith(SURGERY_CONFIRMATION_FINANCIAL_CLEARANCE_BLOCKED_PREFIX));
    assert.match(msg, /Collect surgery deposit/);
    assert.match(msg, /finance admin sign-off/);
  });
});
