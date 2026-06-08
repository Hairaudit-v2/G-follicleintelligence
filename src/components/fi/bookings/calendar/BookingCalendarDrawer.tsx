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
import { normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { cn } from "@/lib/utils";

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

function anchorSummary(tenantId: string, row: FiBookingRow, variant: "default" | "fiOs"): ReactNode {
  const link = variant === "fiOs" ? "text-cyan-300 hover:text-cyan-200 hover:underline" : "text-blue-600 hover:underline";
  const muted = variant === "fiOs" ? "text-slate-400" : "text-gray-700";
  const code = variant === "fiOs" ? "rounded bg-white/[0.06] px-0.5 text-xs text-slate-200" : "rounded bg-gray-100 px-0.5 text-xs";
  const parts: ReactNode[] = [];
  if (row.lead_id) {
    parts.push(
      <Link key="lead" className={link} href={`/fi-admin/${tenantId}/crm/leads/${row.lead_id}`}>
        Lead
      </Link>
    );
  }
  if (row.person_id) {
    parts.push(
      <span key="person" className={muted}>
        Person <code className={code}>{row.person_id.slice(0, 8)}…</code>
      </span>
    );
  }
  if (row.patient_id) {
    parts.push(
      <Link key="patient" className={link} href={`/fi-admin/${tenantId}/patients/${row.patient_id}`}>
        Patient record
      </Link>
    );
  }
  if (row.case_id) {
    parts.push(
      <Link key="case" className={link} href={`/fi-admin/${tenantId}/cases/${row.case_id}`}>
        Case
      </Link>
    );
  }
  if (parts.length === 0) return <span className={variant === "fiOs" ? "text-slate-500" : "text-gray-400"}>—</span>;
  return <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs">{parts}</span>;
}

export function BookingCalendarDrawer({
  tenantId,
  booking,
  assignees,
  clinics,
  adminKey,
  calendarTimezone,
  onClose,
  onChanged,
  onEdit,
  variant = "default",
  patientSummary,
}: {
  tenantId: string;
  booking: FiBookingRow | null;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  adminKey: string;
  calendarTimezone?: string | null;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (b: FiBookingRow) => void;
  /** Dark glass panel aligned with FI OS AppShell. */
  variant?: "default" | "fiOs";
  /** Display label (e.g. patient name from calendar loader). */
  patientSummary?: string | null;
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

  const tz = normalizeCalendarTimezone(calendarTimezone ?? row.timezone);
  const range = `${new Date(row.start_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  })} → ${new Date(row.end_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: tz })}`;

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

  const os = variant === "fiOs";

  return (
    <div
      className={
        os ? "fixed inset-0 z-[52] flex justify-end bg-black/50 backdrop-blur-[2px]" : "fixed inset-0 z-40 flex justify-end bg-black/30"
      }
      role="presentation"
      onClick={onClose}
    >
      <aside
        className={
          os
            ? "h-full w-full max-w-md overflow-y-auto border-l border-white/[0.08] bg-[#0a1424]/95 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur-xl"
            : "h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
        }
        role="dialog"
        aria-label="Booking details"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={
            os
              ? "flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3"
              : "flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3"
          }
        >
          <h2 className={os ? "text-sm font-semibold text-slate-50" : "text-sm font-semibold text-gray-900"}>
            {row.title?.trim() || "Booking"}
          </h2>
          <button
            type="button"
            className={os ? "text-sm text-slate-400 hover:text-cyan-200" : "text-sm text-gray-600 hover:text-gray-900"}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className={cn(os ? "space-y-4 p-4 text-sm text-slate-200" : "space-y-4 p-4 text-sm text-gray-800")}>
          <div className="flex flex-wrap gap-2">
            <BookingTypeBadge type={row.booking_type} />
            <BookingStatusBadge status={row.booking_status} />
          </div>

          {patientSummary?.trim() ? (
            <div>
              <p className={os ? "text-xs font-medium uppercase text-slate-500" : "text-xs font-medium uppercase text-gray-500"}>
                Patient / anchor
              </p>
              <p className={os ? "mt-1 text-base font-medium text-slate-50" : "mt-1 text-base font-medium text-gray-900"}>
                {patientSummary.trim()}
              </p>
            </div>
          ) : null}

          <div>
            <p className={os ? "text-xs font-medium uppercase text-slate-500" : "text-xs font-medium uppercase text-gray-500"}>When</p>
            <p className="mt-1">{range}</p>
          </div>

          <div>
            <p className={os ? "text-xs font-medium uppercase text-slate-500" : "text-xs font-medium uppercase text-gray-500"}>Linked</p>
            <div className="mt-1">{anchorSummary(tenantId, row, variant)}</div>
          </div>

          <div>
            <p className={os ? "text-xs font-medium uppercase text-slate-500" : "text-xs font-medium uppercase text-gray-500"}>Assigned</p>
            <p className="mt-1">{assigneeLabel(assignees, row.assigned_user_id)}</p>
          </div>

          <div>
            <p className={os ? "text-xs font-medium uppercase text-slate-500" : "text-xs font-medium uppercase text-gray-500"}>
              Location / clinic
            </p>
            <p className="mt-1">{clinicOrLocation(clinics, row)}</p>
          </div>

          <div>
            <p className={os ? "text-xs font-medium uppercase text-slate-500" : "text-xs font-medium uppercase text-gray-500"}>Notes</p>
            <p className={os ? "mt-1 whitespace-pre-wrap text-slate-300" : "mt-1 whitespace-pre-wrap text-gray-700"}>
              {row.description?.trim() || "—"}
            </p>
          </div>

          {cancelled ? (
            <div
              className={
                os
                  ? "rounded-lg border border-amber-500/25 bg-amber-950/40 p-3 text-xs text-amber-100"
                  : "rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
              }
            >
              <p className="font-medium">Cancelled</p>
              {row.cancellation_reason?.trim() ? <p className="mt-2">Reason: {row.cancellation_reason}</p> : null}
            </div>
          ) : null}

          <div className={os ? "flex flex-wrap gap-2 border-t border-white/[0.06] pt-4" : "flex flex-wrap gap-2 border-t border-gray-100 pt-4"}>
            {!cancelled && !completed ? (
              <>
                <button
                  type="button"
                  className={
                    os
                      ? "rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-sm text-slate-100 hover:bg-white/[0.08] disabled:opacity-50"
                      : "rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  }
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
                  className={
                    os
                      ? "rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                      : "rounded border border-emerald-600 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                  }
                  disabled={busy}
                  onClick={() => void onComplete()}
                >
                  Complete
                </button>
                <button
                  type="button"
                  className={
                    os
                      ? "rounded-lg border border-red-400/30 bg-red-950/40 px-3 py-1.5 text-sm text-red-100 hover:bg-red-950/60 disabled:opacity-50"
                      : "rounded border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50"
                  }
                  disabled={busy}
                  onClick={() => void onCancel()}
                >
                  Cancel
                </button>
              </>
            ) : completed ? (
              <p className={os ? "text-xs text-slate-500" : "text-xs text-gray-500"}>This booking is completed.</p>
            ) : (
              <p className={os ? "text-xs text-slate-500" : "text-xs text-gray-500"}>Cancelled bookings are locked.</p>
            )}
          </div>
          {feedback ? <p className={os ? "text-sm text-red-300" : "text-sm text-red-600"}>{feedback}</p> : null}
        </div>
      </aside>
    </div>
  );
}
