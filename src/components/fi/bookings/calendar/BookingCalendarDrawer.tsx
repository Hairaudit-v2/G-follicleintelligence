"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import { cancelBookingAction, completeBookingAction } from "@/lib/actions/fi-booking-actions";
import { isBookingCancelled } from "@/src/lib/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { BookingStatusBadge } from "@/src/components/fi/bookings/operator/BookingStatusBadge";
import { BookingTypeBadge } from "@/src/components/fi/bookings/operator/BookingTypeBadge";

function assigneeLabel(options: CrmShellUserPickerOption[], id: string | null): string {
  if (!id) return "Unassigned";
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

export function BookingCalendarDrawer({
  tenantId,
  booking,
  assignees,
  clinics,
  adminKey,
  onClose,
  onChanged,
  onEdit,
}: {
  tenantId: string;
  booking: FiBookingRow | null;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  adminKey: string;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (b: FiBookingRow) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  if (!booking) return null;

  const row = booking;

  const cancelled = isBookingCancelled(row);
  const completed = row.booking_status === "completed";

  const range = `${new Date(row.start_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })} → ${new Date(row.end_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;

  async function onComplete() {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await completeBookingAction(tenantId, row.id, withAdmin({}));
      if (!r.ok) setFeedback(r.error);
      else {
        onChanged();
        onClose();
      }
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
        row.id,
        withAdmin({ cancellationReason: reason.trim() || null })
      );
      if (!r.ok) setFeedback(r.error);
      else {
        onChanged();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="presentation" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
        role="dialog"
        aria-label="Booking details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{row.title?.trim() || "Booking"}</h2>
          <button type="button" className="text-sm text-gray-600 hover:text-gray-900" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-4 p-4 text-sm text-gray-800">
          <div className="flex flex-wrap gap-2">
            <BookingTypeBadge type={row.booking_type} />
            <BookingStatusBadge status={row.booking_status} />
          </div>

          <div>
            <p className="text-xs font-medium uppercase text-gray-500">When</p>
            <p className="mt-1">{range}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Linked</p>
            <div className="mt-1">{anchorSummary(tenantId, row)}</div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Assigned</p>
            <p className="mt-1">{assigneeLabel(assignees, row.assigned_user_id)}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Location / clinic</p>
            <p className="mt-1">{clinicOrLocation(clinics, row)}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-gray-700">{row.description?.trim() || "—"}</p>
          </div>

          {cancelled ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-medium">Cancelled</p>
              {row.cancellation_reason?.trim() ? <p className="mt-2">Reason: {row.cancellation_reason}</p> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            {!cancelled && !completed ? (
              <>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    onEdit(row);
                    onClose();
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded border border-emerald-600 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void onComplete()}
                >
                  Complete
                </button>
                <button
                  type="button"
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void onCancel()}
                >
                  Cancel
                </button>
              </>
            ) : completed ? (
              <p className="text-xs text-gray-500">This booking is completed.</p>
            ) : (
              <p className="text-xs text-gray-500">Cancelled bookings are locked.</p>
            )}
          </div>
          {feedback ? <p className="text-sm text-red-600">{feedback}</p> : null}
        </div>
      </aside>
    </div>
  );
}
