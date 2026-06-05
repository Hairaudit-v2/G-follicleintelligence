"use client";

import { useMemo, useState } from "react";
import { cancelBookingAction, completeBookingAction } from "@/lib/actions/fi-booking-actions";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { bookingStatusLabel, bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";

const card = "rounded border border-gray-200 bg-white p-4 shadow-sm";

function assigneeLabel(options: CrmShellUserPickerOption[], id: string | null): string {
  if (!id) return "Unassigned";
  const o = options.find((x) => x.id === id);
  return o?.email?.trim() || o?.id || id;
}

export function BookingSummaryCard({
  tenantId,
  booking,
  assigneeOptions,
  onEdit,
  onChanged,
  adminKey,
}: {
  tenantId: string;
  booking: FiBookingRow;
  assigneeOptions: CrmShellUserPickerOption[];
  onEdit: () => void;
  onChanged: () => void;
  adminKey: string;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  const cancelled = booking.booking_status === "cancelled" || Boolean(booking.cancelled_at);
  const completed = booking.booking_status === "completed";

  async function onComplete() {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await completeBookingAction(tenantId, booking.id, withAdmin({}));
      if (!r.ok) setFeedback(r.error);
      else onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await cancelBookingAction(tenantId, booking.id, withAdmin({ cancellationReason: null }));
      if (!r.ok) setFeedback(r.error);
      else onChanged();
    } finally {
      setBusy(false);
    }
  }

  const range = useMemo(
    () =>
      `${new Date(booking.start_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} → ${new Date(booking.end_at).toLocaleTimeString(undefined, { timeStyle: "short" })}`,
    [booking.start_at, booking.end_at]
  );

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">{bookingTypeLabel(booking.booking_type)}</p>
          <p className="text-sm font-semibold text-gray-900">{booking.title?.trim() || "Booking"}</p>
          <p className="text-xs text-gray-600">{range}</p>
          <p className="text-xs text-gray-500">
            {bookingStatusLabel(booking.booking_status)}
            {" · "}
            {assigneeLabel(assigneeOptions, booking.assigned_user_id)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!cancelled && !completed ? (
            <>
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                disabled={busy}
                onClick={onEdit}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded border border-emerald-600 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                disabled={busy}
                onClick={() => void onComplete()}
              >
                Complete
              </button>
              <button
                type="button"
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-800 hover:bg-red-50 disabled:opacity-50"
                disabled={busy}
                onClick={() => void onCancel()}
              >
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </div>
      {feedback ? <p className="mt-2 text-xs text-red-600">{feedback}</p> : null}
    </div>
  );
}
