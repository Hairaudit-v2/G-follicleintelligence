import "server-only";

import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { resolveFinancialClearanceForBooking } from "@/src/lib/financialOs/financialClearance.server";
import {
  computeSurgeryReadinessBoardWindow,
  type SurgeryReadinessBoardWindow,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  isSurgeryBookingConfirmationTransition,
  isSurgeryWithinClearanceWindow,
  shouldBlockSurgeryConfirmationForFinancialClearance,
  surgeryConfirmationFinancialClearanceBlockedMessage,
} from "@/src/lib/bookings/bookingSurgeryFinancialClearanceGuardCore";

export type AssertSurgeryBookingConfirmationFinancialClearanceInput = {
  tenantId: string;
  existing: Pick<FiBookingRow, "booking_type" | "booking_status">;
  next: Pick<
    FiBookingRow,
    | "id"
    | "booking_type"
    | "booking_status"
    | "start_at"
    | "case_id"
    | "patient_id"
    | "financial_os_status"
  >;
  now?: Date;
  window?: SurgeryReadinessBoardWindow;
};

/**
 * FI-PH1 guard: blocks surgery booking confirmation when FinancialOS reports
 * `financially_safe_to_proceed !== true` and the procedure is within the tenant 14-day window.
 */
export async function assertSurgeryBookingConfirmationFinancialClearance(
  input: AssertSurgeryBookingConfirmationFinancialClearanceInput
): Promise<void> {
  if (
    !isSurgeryBookingConfirmationTransition({
      bookingType: input.next.booking_type,
      previousBookingStatus: input.existing.booking_status,
      nextBookingStatus: input.next.booking_status,
    })
  ) {
    return;
  }

  const now = input.now ?? new Date();
  let window = input.window;
  if (!window) {
    const settings = await loadTenantOperationalCalendarSettings(input.tenantId.trim());
    window = computeSurgeryReadinessBoardWindow(now, settings.calendarTimezone);
  }

  const withinWindow = isSurgeryWithinClearanceWindow({
    bookingType: input.next.booking_type,
    previousBookingStatus: input.existing.booking_status,
    nextBookingStatus: input.next.booking_status,
    surgeryStartAtIso: input.next.start_at,
    calendarTimezone: window.calendarTimezone,
    todayYmd: window.todayYmd,
    windowEndYmd: window.windowEndYmd,
  });
  if (!withinWindow) return;

  const clearance = await resolveFinancialClearanceForBooking(input.tenantId.trim(), {
    todayYmd: window.todayYmd,
    calendarTimezone: window.calendarTimezone,
    booking: {
      id: input.next.id,
      case_id: input.next.case_id,
      patient_id: input.next.patient_id,
      booking_status: input.next.booking_status,
      financial_os_status: input.next.financial_os_status,
      start_at: input.next.start_at,
    },
  });

  if (!shouldBlockSurgeryConfirmationForFinancialClearance(clearance, true)) return;

  throw new Error(surgeryConfirmationFinancialClearanceBlockedMessage(clearance));
}
