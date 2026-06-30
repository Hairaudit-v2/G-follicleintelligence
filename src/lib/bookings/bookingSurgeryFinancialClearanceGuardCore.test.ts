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

  it("blocks when financially_safe_to_proceed is false within clearance window", () => {
    const blocked = {
      financially_safe_to_proceed: false as const,
    };
    assert.equal(
      shouldBlockSurgeryConfirmationForFinancialClearance(
        {
          ...blocked,
          clearance_state: "not_ready",
          clearance_reason: "Deposit not collected",
          next_required_action: "Collect surgery deposit",
        },
        true
      ),
      true
    );
    assert.equal(
      shouldBlockSurgeryConfirmationForFinancialClearance(
        {
          ...blocked,
          clearance_state: "unavailable",
          clearance_reason: "No data",
          next_required_action: null,
        },
        true
      ),
      true
    );
    assert.equal(
      shouldBlockSurgeryConfirmationForFinancialClearance(
        {
          ...blocked,
          clearance_state: "attention_required",
          clearance_reason: "Balance overdue",
          next_required_action: "Collect balance",
        },
        true
      ),
      true
    );
    assert.equal(
      shouldBlockSurgeryConfirmationForFinancialClearance(
        {
          ...blocked,
          clearance_state: "pathway_pending",
          clearance_reason: "Pathway in progress",
          next_required_action: "Wait for pathway settlement",
        },
        true
      ),
      true
    );
    assert.equal(
      shouldBlockSurgeryConfirmationForFinancialClearance(
        {
          ...blocked,
          clearance_state: "not_ready",
          clearance_reason: "Deposit not collected",
          next_required_action: null,
        },
        false
      ),
      false
    );
  });

  it("allows confirmation when financially_safe_to_proceed is true", () => {
    const safe = { financially_safe_to_proceed: true as const, next_required_action: null };
    for (const clearance_state of [
      "deposit_ready",
      "financially_cleared",
      "paid_in_full",
    ] as const) {
      assert.equal(
        shouldBlockSurgeryConfirmationForFinancialClearance(
          {
            ...safe,
            clearance_state,
            clearance_reason: "OK",
          },
          true
        ),
        false
      );
    }
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
