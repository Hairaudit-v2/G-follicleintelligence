"use client";

import { useEffect, useMemo, useState } from "react";
import { updateBookingAction } from "@/lib/actions/fi-booking-actions";
import { BOOKING_TYPES, isBookingCancelled } from "@/src/lib/bookings";
import {
  defaultProcedureDurationMinutes,
  formatPriceAud,
  serviceForBookingType,
} from "@/src/lib/bookings/servicesCatalog";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import {
  endLocalFromStartLocalAndProcedure,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/src/components/fi/bookings/bookingFormUtils";

const WRITABLE_STATUSES = ["scheduled", "confirmed", "arrived", "no_show"] as const;

export function BookingEditDrawer({
  tenantId,
  booking,
  reminderJobs,
  assignees,
  clinics,
  adminKey,
  clinicCalendarTimezone,
  services = [],
  onClose,
  onSaved,
}: {
  tenantId: string;
  booking: FiBookingRow | null;
  reminderJobs: FiReminderJobWithTemplate[];
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  adminKey: string;
  /** Tenant/clinic IANA timezone for datetime-local fields. */
  clinicCalendarTimezone?: string | null;
  services?: FiServiceRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [bookingType, setBookingType] = useState("");
  const [bookingStatus, setBookingStatus] = useState<string>("scheduled");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [timezone, setTimezone] = useState("");
  const [location, setLocation] = useState("");
  const [assignee, setAssignee] = useState("");
  const [clinicId, setClinicId] = useState("");

  useEffect(() => {
    if (!booking) return;
    setBookingType(booking.booking_type);
    setBookingStatus(booking.booking_status);
    setTitle(booking.title ?? "");
    setDescription(booking.description ?? "");
    setStartLocal(toDatetimeLocalValue(booking.start_at, clinicCalendarTimezone ?? booking.timezone));
    setEndLocal(toDatetimeLocalValue(booking.end_at, clinicCalendarTimezone ?? booking.timezone));
    setTimezone(booking.timezone ?? clinicCalendarTimezone ?? "");
    setLocation(booking.location ?? "");
    setAssignee(booking.assigned_user_id ?? "");
    setClinicId(booking.clinic_id ?? "");
    setFeedback(null);
  }, [booking, clinicCalendarTimezone]);

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  const typeOptions = useMemo(() => {
    const u = new Set<string>([...BOOKING_TYPES]);
    if (bookingType?.trim()) u.add(bookingType.trim());
    return Array.from(u);
  }, [bookingType]);

  const selectedCatalog = useMemo(() => serviceForBookingType(services, bookingType), [services, bookingType]);

  const datetimeTz = useMemo(
    () => clinicCalendarTimezone ?? (timezone.trim() || undefined),
    [clinicCalendarTimezone, timezone]
  );

  function onProcedureTypeChange(nextType: string) {
    setBookingType(nextType);
    const nextEnd = endLocalFromStartLocalAndProcedure(startLocal, nextType, datetimeTz, services);
    if (nextEnd) setEndLocal(nextEnd);
  }

  const cancelled = booking ? isBookingCancelled(booking) : false;
  const completed = booking?.booking_status === "completed";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!booking || cancelled || completed) return;
    setBusy(true);
    setFeedback(null);
    try {
      const tz = clinicCalendarTimezone ?? (timezone.trim() || undefined);
      const startIso = fromDatetimeLocalValue(startLocal, tz);
      const endIso = fromDatetimeLocalValue(endLocal, tz);
      if (!startIso || !endIso) {
        setFeedback("Start and end times are required.");
        return;
      }
      const statusTrim = bookingStatus.trim();
      if (!WRITABLE_STATUSES.includes(statusTrim as (typeof WRITABLE_STATUSES)[number])) {
        setFeedback("Choose a writable status (scheduled, confirmed, arrived, or no-show).");
        return;
      }

      const r = await updateBookingAction(
        tenantId,
        booking.id,
        withAdmin({
          leadId: booking.lead_id,
          personId: booking.person_id,
          patientId: booking.patient_id,
          caseId: booking.case_id,
          bookingType,
          bookingStatus: statusTrim,
          title: title.trim() || null,
          description: description.trim() || null,
          startAt: startIso,
          endAt: endIso,
          timezone: timezone.trim() || null,
          location: location.trim() || null,
          clinicId: clinicId.trim() || null,
          assignedUserId: assignee.trim() || null,
          metadata: booking.metadata ?? {},
        })
      );
      if (!r.ok) setFeedback(r.error);
      else {
        onSaved();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" role="presentation" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
        role="dialog"
        aria-label="Edit booking"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Edit booking</h2>
          <button type="button" className="text-sm text-gray-600 hover:text-gray-900" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-4 p-4 text-sm">
          {cancelled ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-medium">Cancelled bookings are locked except for viewing cancellation details.</p>
              {booking.cancellation_reason?.trim() ? (
                <p className="mt-2 text-gray-800">Reason: {booking.cancellation_reason}</p>
              ) : null}
              {booking.cancelled_at ? (
                <p className="mt-1 text-gray-700">Cancelled at: {new Date(booking.cancelled_at).toLocaleString()}</p>
              ) : null}
            </div>
          ) : completed ? (
            <p className="text-xs text-gray-600">This booking is completed and cannot be edited here.</p>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
              <div className="text-xs text-gray-600">
                <span className="font-medium text-gray-800">Anchors (read-only): </span>
                {booking.lead_id ? `Lead ${booking.lead_id.slice(0, 8)}… ` : ""}
                {booking.person_id ? `Person ${booking.person_id.slice(0, 8)}… ` : ""}
                {booking.patient_id ? `Patient ${booking.patient_id.slice(0, 8)}… ` : ""}
                {booking.case_id ? `Patient ${booking.case_id.slice(0, 8)}…` : ""}
                {!booking.lead_id && !booking.person_id && !booking.patient_id && !booking.case_id ? "—" : ""}
              </div>
              <label className="block text-xs font-medium text-gray-700">
                Type
                <select
                  value={bookingType}
                  onChange={(e) => onProcedureTypeChange(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {bookingTypeLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Status
                <select
                  value={bookingStatus}
                  onChange={(e) => setBookingStatus(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                >
                  {WRITABLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Start (local)
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                End (local)
                <input
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Default slot for this procedure type: {defaultProcedureDurationMinutes(bookingType, services)} min
                  (end updates when you change type).
                  {selectedCatalog && selectedCatalog.base_price > 0 ? (
                    <> Suggested price: {formatPriceAud(selectedCatalog.base_price)}.</>
                  ) : null}
                </p>
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Timezone (optional)
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Location
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                />
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Clinic
                <select
                  value={clinicId}
                  onChange={(e) => setClinicId(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                >
                  <option value="">None</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-700">
                Assigned user
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                >
                  <option value="">Unassigned</option>
                  {assignees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email ?? u.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
              {feedback ? <p className="text-sm text-red-600">{feedback}</p> : null}
            </form>
          )}
          {reminderJobs.length > 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
              <p className="font-semibold text-gray-900">Reminder queue</p>
              <ul className="mt-2 space-y-1">
                {reminderJobs.map((j) => (
                  <li key={j.id} className="flex flex-wrap justify-between gap-1 border-t border-gray-200 pt-1 first:border-0 first:pt-0">
                    <span className="font-medium">{j.template_name || "Template"}</span>
                    <span className="text-gray-600">
                      {j.template_type} · {j.template_trigger_event}
                    </span>
                    <span className="w-full text-gray-600 sm:w-auto">
                      {j.status} · scheduled {new Date(j.scheduled_at).toLocaleString()}
                    </span>
                    {j.error_log?.trim() && (j.status === "failed" || j.status === "cancelled") ? (
                      <span className="w-full text-[11px] text-amber-800">{j.error_log}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : booking.patient_id ? (
            <p className="text-xs text-gray-500">
              No reminder jobs for this booking yet. Jobs appear when the patient has reminder consent and active templates
              exist.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
