"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import { cancelBookingAction, completeBookingAction } from "@/lib/actions/fi-booking-actions";
import { isBookingCancelled } from "@/src/lib/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { formatBookingWindowInTimezone, normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { BookingTypeBadge } from "./BookingTypeBadge";

function assigneeLabel(options: CrmShellUserPickerOption[], id: string | null): string {
  if (!id) return "—";
  const o = options.find((x) => x.id === id);
  return o?.email?.trim() || o?.id.slice(0, 8) || id.slice(0, 8);
}

function clinicOrLocation(clinics: CrmShellClinicOption[], row: FiBookingRow): string {
  if (row.clinic_id) {
    const c = clinics.find((x) => x.id === row.clinic_id);
    if (c) return c.display_name;
    return row.clinic_id.slice(0, 8);
  }
  return row.location?.trim() || "—";
}

function anchorSummary(tenantId: string, row: FiBookingRow): ReactNode {
  const parts: ReactNode[] = [];
  if (row.lead_id) {
    parts.push(
      <Link key="lead" className="text-blue-600 hover:underline" href={`/fi-admin/${tenantId}/crm/leads/${row.lead_id}`}>
        Lead
      </Link>
    );
  }
  if (row.person_id) {
    parts.push(
      <span key="person" className="text-gray-700">
        Person <code className="rounded bg-gray-100 px-0.5 text-xs">{row.person_id.slice(0, 8)}…</code>
      </span>
    );
  }
  if (row.patient_id) {
    parts.push(
      <Link
        key="patient"
        className="text-blue-600 hover:underline"
        href={`/fi-admin/${tenantId}/patients/${row.patient_id}`}
      >
        Patient
      </Link>
    );
  }
  if (row.case_id) {
    parts.push(
      <Link key="case" className="text-blue-600 hover:underline" href={`/fi-admin/${tenantId}/cases/${row.case_id}`}>
        Case
      </Link>
    );
  }
  if (parts.length === 0) return <span className="text-gray-400">—</span>;
  return <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs">{parts}</span>;
}

export function BookingOperatorRow({
  tenantId,
  booking,
  assignees,
  clinics,
  adminKey,
  onEdit,
  onChanged,
}: {
  tenantId: string;
  booking: FiBookingRow;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  adminKey: string;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const cancelled = isBookingCancelled(booking);
  const completed = booking.booking_status === "completed";

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  const tz = normalizeCalendarTimezone(booking.timezone);
  const range = formatBookingWindowInTimezone(booking.start_at, booking.end_at, tz, { endPart: "timeOnly" });

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
    const reason = window.prompt("Cancellation reason (optional):") ?? "";
    setBusy(true);
    setFeedback(null);
    try {
      const r = await cancelBookingAction(
        tenantId,
        booking.id,
        withAdmin({ cancellationReason: reason.trim() || null })
      );
      if (!r.ok) setFeedback(r.error);
      else onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-gray-100 text-sm">
      <td className="whitespace-nowrap px-3 py-2 align-top text-gray-800">{range}</td>
      <td className="px-3 py-2 align-top">
        <BookingTypeBadge type={booking.booking_type} />
      </td>
      <td className="px-3 py-2 align-top">
        <BookingStatusBadge status={booking.booking_status} />
      </td>
      <td className="max-w-[14rem] px-3 py-2 align-top text-gray-900">
        <div className="font-medium">{booking.title?.trim() || "Booking"}</div>
        {cancelled && booking.cancellation_reason?.trim() ? (
          <p className="mt-0.5 text-xs text-gray-500">Reason: {booking.cancellation_reason}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 align-top">{anchorSummary(tenantId, booking)}</td>
      <td className="whitespace-nowrap px-3 py-2 align-top text-gray-700">{assigneeLabel(assignees, booking.assigned_user_id)}</td>
      <td className="max-w-[10rem] px-3 py-2 align-top text-gray-700">{clinicOrLocation(clinics, booking)}</td>
      <td className="whitespace-nowrap px-3 py-2 align-top">
        <div className="flex flex-wrap gap-1">
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
          ) : cancelled ? (
            <span className="text-xs text-gray-500">Locked</span>
          ) : (
            <span className="text-xs text-gray-500">Done</span>
          )}
        </div>
        {feedback ? <p className="mt-1 text-xs text-red-600">{feedback}</p> : null}
      </td>
    </tr>
  );
}
