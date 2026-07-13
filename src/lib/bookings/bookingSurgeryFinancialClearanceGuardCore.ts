/**
 * Pure helpers for the narrow surgery-confirmation financial clearance guard (FI-PH1).
 * Does not load DB — used by updateBooking via the server wrapper.
 */

import type { FinancialClearanceResult } from "@/src/lib/financialOs/financialClearanceCore";
import { moneyClearanceBlockedStaffMessage } from "@/src/lib/financialOs/moneyTrustCopy";
import { isInstantInTenantInclusiveDayWindow } from "@/src/lib/surgery/surgeryReadinessBoardModel";

export const SURGERY_CONFIRMATION_FINANCIAL_CLEARANCE_BLOCKED_PREFIX =
  "Surgery confirmation blocked:";

export type SurgeryConfirmationGuardContext = {
  bookingType: string;
  previousBookingStatus: string;
  nextBookingStatus: string;
  surgeryStartAtIso: string;
  calendarTimezone: string;
  todayYmd: string;
  windowEndYmd: string;
};

/** True when updateBooking is transitioning a surgery booking to confirmed. */
export function isSurgeryBookingConfirmationTransition(input: {
  bookingType: string;
  previousBookingStatus: string;
  nextBookingStatus: string;
}): boolean {
  if (input.bookingType.trim().toLowerCase() !== "surgery") return false;
  if (input.nextBookingStatus.trim().toLowerCase() !== "confirmed") return false;
  return input.previousBookingStatus.trim().toLowerCase() !== "confirmed";
}

export function isSurgeryWithinClearanceWindow(ctx: SurgeryConfirmationGuardContext): boolean {
  const startMs = Date.parse(ctx.surgeryStartAtIso);
  if (!Number.isFinite(startMs)) return false;
  return isInstantInTenantInclusiveDayWindow(
    startMs,
    ctx.calendarTimezone.trim(),
    ctx.todayYmd.trim(),
    ctx.windowEndYmd.trim()
  );
}

/**
 * Blocks when FinancialOS reports the surgery is not financially safe within the 14-day window.
 * Uses `financially_safe_to_proceed` so `unavailable`, `attention_required`, and `pathway_pending`
 * also block confirmation — not only explicit `not_ready`.
 */
export function shouldBlockSurgeryConfirmationForFinancialClearance(
  clearance: Pick<
    FinancialClearanceResult,
    "clearance_state" | "clearance_reason" | "next_required_action" | "financially_safe_to_proceed"
  >,
  surgeryWithinClearanceWindow: boolean
): boolean {
  if (!surgeryWithinClearanceWindow) return false;
  return clearance.financially_safe_to_proceed !== true;
}

export function surgeryConfirmationFinancialClearanceBlockedMessage(
  clearance: Pick<FinancialClearanceResult, "clearance_reason" | "next_required_action">
): string {
  const detail = clearance.next_required_action?.trim() || clearance.clearance_reason?.trim();
  // FI-TRUST-MONEY-AND-READINESS-1 — staff language uses Money hub, not FinancialOS brand.
  return moneyClearanceBlockedStaffMessage(detail);
}
