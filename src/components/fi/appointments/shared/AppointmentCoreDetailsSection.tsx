"use client";

import type { FormEvent } from "react";
import { bookingDurationMinutes } from "@/src/lib/bookings/appointmentMetadata";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { AppointmentStatusHistoryEntry } from "@/src/lib/bookings/appointmentMetadata";
import { appointmentCardClass } from "./appointmentSharedStyles";

const WRITABLE_STATUSES = ["scheduled", "confirmed", "arrived", "no_show"] as const;

function userLabel(options: CrmShellUserPickerOption[], id: string | null): string {
  if (!id) return "—";
  const o = options.find((x) => x.id === id);
  return o?.email?.trim() || `${id.slice(0, 8)}…`;
}

function clinicLabel(clinics: CrmShellClinicOption[], row: FiBookingRow): string {
  if (row.clinic_id) {
    const c = clinics.find((x) => x.id === row.clinic_id);
    return c?.display_name ?? row.clinic_id.slice(0, 8);
  }
  return row.location?.trim() || "—";
}

export function AppointmentCoreDetailsSection({
  booking,
  assignees,
  clinics,
  statusHistory,
  canMutate,
  rescheduleOpen,
  onToggleReschedule,
  startLocal,
  endLocal,
  bookingStatus,
  onStartLocalChange,
  onEndLocalChange,
  onBookingStatusChange,
  onRescheduleSubmit,
  rescheduleBusy,
  rescheduleErr,
}: {
  booking: FiBookingRow;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  statusHistory: AppointmentStatusHistoryEntry[];
  canMutate: boolean;
  rescheduleOpen: boolean;
  onToggleReschedule: () => void;
  startLocal: string;
  endLocal: string;
  bookingStatus: string;
  onStartLocalChange: (v: string) => void;
  onEndLocalChange: (v: string) => void;
  onBookingStatusChange: (v: string) => void;
  onRescheduleSubmit: (e: FormEvent) => void;
  rescheduleBusy: boolean;
  rescheduleErr: string | null;
}) {
  const durationMin = bookingDurationMinutes(booking);
  const range = `${new Date(booking.start_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })} → ${new Date(booking.end_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;

  const surgeonId = (booking.metadata?.surgeon_user_id as string | undefined) ?? null;
  const consultantId = (booking.metadata?.consultant_user_id as string | undefined) ?? null;
  const techId = (booking.metadata?.tech_user_id as string | undefined) ?? null;

  return (
    <section className={appointmentCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Schedule & team</h3>
      <p className="text-sm text-slate-100">{range}</p>
      <p className="mt-1 text-xs text-slate-400">
        Duration: {durationMin > 0 ? `${durationMin} min` : "—"}
        {booking.timezone?.trim() ? ` · ${booking.timezone}` : ""}
      </p>

      <dl className="mt-3 grid gap-1.5 text-xs text-slate-300">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Primary assignee</dt>
          <dd>{userLabel(assignees, booking.assigned_user_id)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Surgeon</dt>
          <dd>{userLabel(assignees, surgeonId)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Consultant</dt>
          <dd>{userLabel(assignees, consultantId)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Technician</dt>
          <dd>{userLabel(assignees, techId)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Clinic / location</dt>
          <dd>{clinicLabel(clinics, booking)}</dd>
        </div>
      </dl>

      {canMutate ? (
        <div className="mt-3 border-t border-white/[0.06] pt-2">
          <button type="button" className="text-xs font-medium text-blue-300 hover:underline" onClick={onToggleReschedule}>
            {rescheduleOpen ? "Hide reschedule" : "Reschedule / update status"}
          </button>
          {rescheduleOpen ? (
            <form className="mt-2 space-y-2" onSubmit={onRescheduleSubmit}>
              <label className="block text-xs text-slate-400">
                Start
                <input
                  type="datetime-local"
                  className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1 text-sm"
                  value={startLocal}
                  onChange={(e) => onStartLocalChange(e.target.value)}
                />
              </label>
              <label className="block text-xs text-slate-400">
                End
                <input
                  type="datetime-local"
                  className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1 text-sm"
                  value={endLocal}
                  onChange={(e) => onEndLocalChange(e.target.value)}
                />
              </label>
              <label className="block text-xs text-slate-400">
                Status
                <select
                  className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1 text-sm"
                  value={bookingStatus}
                  onChange={(e) => onBookingStatusChange(e.target.value)}
                >
                  {WRITABLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {!WRITABLE_STATUSES.includes(bookingStatus as (typeof WRITABLE_STATUSES)[number]) ? (
                    <option value={bookingStatus}>{bookingStatus}</option>
                  ) : null}
                </select>
              </label>
              {rescheduleErr ? <p className="text-xs text-rose-300">{rescheduleErr}</p> : null}
              <button
                type="submit"
                disabled={rescheduleBusy}
                className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {rescheduleBusy ? "Saving…" : "Save schedule"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 border-t border-white/[0.06] pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status history</p>
        {statusHistory.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">No history recorded yet.</p>
        ) : (
          <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto text-xs">
            {statusHistory.slice(0, 12).map((h, i) => (
              <li key={`${h.at}-${h.status}-${i}`} className="border-l-2 border-white/[0.06] pl-2">
                <span className="text-gray-500">{h.at}</span> · <span className="font-medium">{h.status}</span>
                {h.note ? <span className="text-slate-400"> — {h.note}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
