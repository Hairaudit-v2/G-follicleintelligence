"use client";

import type { AppointmentInstructionsSentMetadata } from "@/src/lib/bookings/appointmentMetadata";
import { isBookingCancelled } from "@/src/lib/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { appointmentCardClass } from "./appointmentSharedStyles";

export function AppointmentActionsSection({
  booking,
  instructionsSent,
  canMutate,
  actionBusy,
  actionErr,
  instructionsBusy,
  instructionsErr,
  onRescheduleToggle,
  onComplete,
  onCancel,
  onSendPreOp,
  onSendPostOp,
}: {
  booking: FiBookingRow;
  instructionsSent: AppointmentInstructionsSentMetadata;
  canMutate: boolean;
  actionBusy: boolean;
  actionErr: string | null;
  instructionsBusy: boolean;
  instructionsErr: string | null;
  onRescheduleToggle: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onSendPreOp: () => void;
  onSendPostOp: () => void;
}) {
  const cancelled = isBookingCancelled(booking);
  const completed = booking.booking_status === "completed";

  return (
    <section className={appointmentCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</h3>

      {!canMutate ? (
        <p className="text-xs text-amber-900">Your role can view appointments but not change them here.</p>
      ) : null}

      {canMutate && !cancelled && !completed ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
            disabled={actionBusy}
            onClick={onRescheduleToggle}
          >
            Reschedule
          </button>
          <button
            type="button"
            className="rounded border border-emerald-600 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
            disabled={actionBusy}
            onClick={() => void onComplete()}
          >
            Complete
          </button>
          <button
            type="button"
            className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-800 hover:bg-red-50 disabled:opacity-50"
            disabled={actionBusy}
            onClick={() => void onCancel()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded border border-blue-300 px-3 py-1.5 text-xs text-blue-800 hover:bg-blue-50 disabled:opacity-50"
            disabled={instructionsBusy}
            onClick={() => void onSendPreOp()}
          >
            {instructionsSent.pre_op_at ? "Re-log pre-op" : "Send pre-op instructions"}
          </button>
          <button
            type="button"
            className="rounded border border-blue-300 px-3 py-1.5 text-xs text-blue-800 hover:bg-blue-50 disabled:opacity-50"
            disabled={instructionsBusy}
            onClick={() => void onSendPostOp()}
          >
            {instructionsSent.post_op_at ? "Re-log post-op" : "Send post-op instructions"}
          </button>
        </div>
      ) : null}

      {actionErr ? <p className="mt-2 text-xs text-red-700">{actionErr}</p> : null}
      {instructionsErr ? <p className="mt-2 text-xs text-red-700">{instructionsErr}</p> : null}
      <p className="mt-2 text-xs text-gray-500">
        Instruction sends log CRM activity and timestamp; delivery uses your reminder templates when configured.
      </p>
    </section>
  );
}
