"use server";

/**
 * Reception Board Command Center — thin mutation orchestration.
 * Delegates to existing FI OS workflow engines; no duplicate business logic.
 */

export { receptionBoardFlowAction } from "@/lib/actions/reception-board-flow-action";

import { receptionBoardFlowAction } from "@/lib/actions/reception-board-flow-action";
import type { ReceptionBoardFlowActionKind } from "@/src/lib/fiOs/receptionBoardFlowPolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type ReceptionBoardPatientTransitionInput = {
  action: ReceptionBoardFlowActionKind;
  adminKey?: string;
  reason?: string | null;
};

/**
 * Advance a patient through the live arrival queue.
 * Writes booking status, reception phase metadata, PIN audit, and CRM gates via the existing flow action.
 */
export async function receptionBoardTransitionPatient(
  tenantId: string,
  bookingId: string,
  input: ReceptionBoardPatientTransitionInput
): Promise<{ ok: true; booking: FiBookingRow } | { ok: false; error: string }> {
  return receptionBoardFlowAction(tenantId, bookingId, {
    action: input.action,
    adminKey: input.adminKey,
    reason: input.reason ?? null,
  });
}