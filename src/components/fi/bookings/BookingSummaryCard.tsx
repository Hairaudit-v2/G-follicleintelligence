"use client";

import { useMemo, useState } from "react";
import { cancelBookingAction, completeBookingAction } from "@/lib/actions/fi-booking-actions";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { bookingStatusLabel, bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { formatBookingWindowInTimezone, normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { bookingAssignmentDisplay } from "@/src/lib/staff/staffAssigneeDisplay";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";

const card = "rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40";

export function BookingSummaryCard({
  tenantId,
  booking,
  assigneeOptions,
  userAssignees = [],
  onEdit,
  onChanged,
  adminKey,
}: {
  tenantId: string;
  booking: FiBookingRow;
  assigneeOptions: ClinicalStaffPickerOption[];
  userAssignees?: CrmShellUserPickerOption[];
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

  const range = useMemo(() => {
    const tz = normalizeCalendarTimezone(booking.timezone);
    return formatBookingWindowInTimezone(booking.start_at, booking.end_at, tz, { endPart: "timeOnly" });
  }, [booking.start_at, booking.end_at, booking.timezone]);

  const assignment = useMemo(
    () => bookingAssignmentDisplay(assigneeOptions, userAssignees, booking),
    [assigneeOptions, userAssignees, booking]
  );

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">{bookingTypeLabel(booking.booking_type)}</p>
          <p className="text-sm font-semibold text-slate-100">{booking.title?.trim() || "Booking"}</p>
          <p className="text-xs text-slate-400">{range}</p>
          <p className="text-xs text-gray-500">
            {bookingStatusLabel(booking.booking_status)}
            {" · "}
            {assignment.summaryLine}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!cancelled && !completed ? (
            <>
              <button
                type="button"
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.03] disabled:opacity-50"
                disabled={busy}
                onClick={onEdit}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded border border-emerald-600 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                disabled={busy}
                onClick={() => void onComplete()}
              >
                Complete
              </button>
              <button
                type="button"
                className="rounded border border-red-300 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                disabled={busy}
                onClick={() => void onCancel()}
              >
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </div>
      {feedback ? <p className="mt-2 text-xs text-rose-300">{feedback}</p> : null}
    </div>
  );
}
