"use server";

import { z, ZodError } from "zod";

import { cancelBookingAction, completeBookingAction } from "@/lib/actions/fi-booking-actions";
import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { getStaffPinClinicSessionIfValid } from "@/src/lib/staffPin/staffPinSession.server";
import { insertFiStaffPinAuditEvent } from "@/src/lib/staffPin/staffPinAudit.server";
import type { StaffPinClinicSession } from "@/src/lib/staffPin/staffPinPermissions";
import { loadBookingForTenant } from "@/src/lib/bookings/bookings";
import { updateBooking } from "@/src/lib/bookings/server";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { loadReceptionOperationalDayWindow } from "@/src/lib/fiOs/receptionBoardOperationalWindow.server";
import {
  RECEPTION_BOARD_FLOW_ACTIONS,
  type ReceptionBoardFlowActionKind,
  applyPhaseIntentToMetadataForAction,
  assertBookingMutableForReceptionFlow,
  assertBookingStartInOperationalWindow,
  staffPinMayRunReceptionFlowAction,
  receptionFlowAuditPhaseLabel,
} from "@/src/lib/fiOs/receptionBoardFlowPolicy";

const receptionBoardFlowBodySchema = z
  .object({
    adminKey: z.string().optional(),
    action: z.enum(
      RECEPTION_BOARD_FLOW_ACTIONS as unknown as [ReceptionBoardFlowActionKind, ...ReceptionBoardFlowActionKind[]]
    ),
    reason: z.string().max(4000).optional().nullable(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function metadataRecordFromRow(row: FiBookingRow): Record<string, unknown> {
  const m = row.metadata;
  if (m && typeof m === "object" && !Array.isArray(m)) return { ...(m as Record<string, unknown>) };
  return {};
}

async function auditReceptionPinAction(opts: {
  pin: StaffPinClinicSession;
  tenantId: string;
  bookingId: string;
  action: ReceptionBoardFlowActionKind;
  before: FiBookingRow;
  after: FiBookingRow;
}): Promise<void> {
  const detail: Record<string, unknown> = {
    bookingId: opts.bookingId,
    action: opts.action,
    previousBookingStatus: opts.before.booking_status,
    nextBookingStatus: opts.after.booking_status,
    previousReceptionPhase: receptionFlowAuditPhaseLabel(metadataRecordFromRow(opts.before)),
    nextReceptionPhase: receptionFlowAuditPhaseLabel(metadataRecordFromRow(opts.after)),
  };
  await insertFiStaffPinAuditEvent({
    tenantId: opts.tenantId,
    eventKind: "staff_pin.reception_board_action",
    staffId: opts.pin.staffId,
    detail,
  });
}

/**
 * Reception Board V1.1 — single entry for status/phase mutations with staff-PIN-safe auth.
 * PIN sessions may not cancel (use full CRM login). Metadata merges are server-controlled only.
 */
export async function receptionBoardFlowAction(
  tenantId: string,
  bookingId: string,
  body: unknown
): Promise<{ ok: true; booking: FiBookingRow } | { ok: false; error: string }> {
  try {
    const parsed = receptionBoardFlowBodySchema.parse(body ?? {});
    const tid = tenantId.trim();
    const bid = bookingId.trim();

    const pin = await getStaffPinClinicSessionIfValid(tid);
    const pinActive = Boolean(pin && pin.tenantId.trim() === tid);

    if (parsed.action === "cancel" && pinActive) {
      return { ok: false, error: "Cancellation requires a full team login." };
    }

    const booking = await loadBookingForTenant(tid, bid);
    if (!booking) return { ok: false, error: "Booking not found." };

    const { localStartIso, localEndIso } = await loadReceptionOperationalDayWindow(tid);
    const w = assertBookingStartInOperationalWindow(booking.start_at, localStartIso, localEndIso);
    if (!w.ok) return { ok: false, error: w.error };

    if (parsed.action === "cancel") {
      const cancelled = await cancelBookingAction(tid, bid, {
        adminKey: parsed.adminKey,
        cancellationReason: parsed.reason ?? null,
      });
      if (!cancelled.ok) return { ok: false, error: cancelled.error };
      return { ok: true, booking: cancelled.booking };
    }

    if (parsed.action === "complete") {
      const mut = assertBookingMutableForReceptionFlow(booking.booking_status);
      if (!mut.ok) return { ok: false, error: mut.error };
      const completed = await completeBookingAction(tid, bid, { adminKey: parsed.adminKey });
      if (!completed.ok) return { ok: false, error: completed.error };
      if (pinActive && pin) {
        await auditReceptionPinAction({
          pin,
          tenantId: tid,
          bookingId: bid,
          action: "complete",
          before: booking,
          after: completed.booking,
        });
      }
      return { ok: true, booking: completed.booking };
    }

    const mut = assertBookingMutableForReceptionFlow(booking.booking_status);
    if (!mut.ok) return { ok: false, error: mut.error };

    if (pinActive && pin) {
      if (!staffPinMayRunReceptionFlowAction(parsed.action)) {
        return { ok: false, error: "This action is not allowed for a PIN session." };
      }
      await assertCrmTenantWriteAllowed({
        tenantId: tid,
        adminKey: parsed.adminKey,
        request: undefined,
        staffPinFloorAction: "reception.board_flow",
      });
    } else {
      await assertCrmTenantWriteAllowed({ tenantId: tid, adminKey: parsed.adminKey, request: undefined });
    }

    const rowMeta = metadataRecordFromRow(booking);
    let nextStatus: string;
    let nextMeta: Record<string, unknown>;
    const a = parsed.action;
    if (a === "mark_arrived") {
      nextStatus = "arrived";
      nextMeta = applyPhaseIntentToMetadataForAction("mark_arrived", rowMeta);
    } else if (a === "start_consultation") {
      nextStatus = "arrived";
      nextMeta = applyPhaseIntentToMetadataForAction("start_consultation", rowMeta);
    } else if (a === "start_treatment") {
      nextStatus = "arrived";
      nextMeta = applyPhaseIntentToMetadataForAction("start_treatment", rowMeta);
    } else if (a === "mark_no_show") {
      nextStatus = "no_show";
      nextMeta = applyPhaseIntentToMetadataForAction("mark_no_show", rowMeta);
    } else {
      return { ok: false, error: "Unsupported action." };
    }

    const after = await updateBooking({
      tenantId: tid,
      bookingId: bid,
      bookingStatus: nextStatus,
      metadata: nextMeta,
    });

    if (pinActive && pin) {
      await auditReceptionPinAction({
        pin,
        tenantId: tid,
        bookingId: bid,
        action: a,
        before: booking,
        after,
      });
    }

    return { ok: true, booking: after };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
