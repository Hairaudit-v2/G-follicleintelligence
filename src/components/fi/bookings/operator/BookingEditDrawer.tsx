"use client";

import { useEffect, useMemo, useState } from "react";
import { updateBookingAction, loadBookingResourceAssignmentsAction, loadBookingReminderJobsAction } from "@/lib/actions/fi-booking-actions";
import { previewBookingConflictsAction } from "@/lib/actions/fi-booking-conflict-preview-actions";
import { BookingConflictPreview } from "@/src/components/calendar/BookingConflictPreview";
import { NextAvailableBookingSlots } from "@/src/components/calendar/NextAvailableBookingSlots";
import type { BookingConflictPreviewResult } from "@/src/lib/calendar/bookingConflictPreview.server";
import type { NextAvailableBookingSlot } from "@/src/lib/calendar/findNextAvailableBookingSlots.server";
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
import { StaffClinicalSelect } from "@/src/components/fi/staff/StaffClinicalPickerFields";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";
import { canSelectStaffForClinicalPicker, type ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import {
  endLocalFromStartLocalAndProcedure,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/src/components/fi/bookings/bookingFormUtils";
import { formatIsoDateTimeInTimezone, normalizeCalendarTimezone, bookingDurationMinutesUtc } from "@/src/lib/calendar/calendarTimezone";

const WRITABLE_STATUSES = ["scheduled", "confirmed", "arrived", "no_show"] as const;

export function BookingEditDrawer({
  tenantId,
  booking,
  reminderJobs,
  reminderJobsLazy = false,
  clinicalStaffOptions,
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
  /** When true, ignore {@link reminderJobs} and load jobs after open (operational calendar). */
  reminderJobsLazy?: boolean;
  clinicalStaffOptions: ClinicalStaffPickerOption[];
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
  const [lazyReminderJobs, setLazyReminderJobs] = useState<FiReminderJobWithTemplate[] | null>(null);
  const [lazyReminderJobsLoading, setLazyReminderJobsLoading] = useState(false);

  const [bookingType, setBookingType] = useState("");
  const [bookingStatus, setBookingStatus] = useState<string>("scheduled");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [timezone, setTimezone] = useState("");
  const [location, setLocation] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [draftRoomId, setDraftRoomId] = useState("");

  const cancelled = booking ? isBookingCancelled(booking) : false;
  const completed = booking?.booking_status === "completed";

  const [resourceDraft, setResourceDraft] = useState<
    Array<{ resource_type: "staff" | "room"; resource_id: string; role_label?: string | null }>
  >([]);
  const [resourceDraftHydrated, setResourceDraftHydrated] = useState(false);

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
    setAssignedStaffId(booking.assigned_staff_id ?? "");
    setClinicId(booking.clinic_id ?? "");
    setDraftRoomId(booking.room_id?.trim() ?? "");
    setFeedback(null);
    setResourceDraft([]);
    setResourceDraftHydrated(false);
  }, [booking, clinicCalendarTimezone]);

  useEffect(() => {
    if (!booking || cancelled || completed) {
      setResourceDraft([]);
      setResourceDraftHydrated(true);
      return;
    }
    let cancelledEffect = false;
    setResourceDraftHydrated(false);
    void loadBookingResourceAssignmentsAction(tenantId, booking.id, adminKey).then((r) => {
      if (cancelledEffect) return;
      if (r.ok) {
        setResourceDraft(
          r.assignments.map((a) => ({
            resource_type: a.resource_type,
            resource_id: a.resource_id,
            role_label: a.role_label,
          }))
        );
      } else {
        setResourceDraft([]);
      }
      setResourceDraftHydrated(true);
    });
    return () => {
      cancelledEffect = true;
    };
  }, [adminKey, booking, cancelled, completed, tenantId]);

  useEffect(() => {
    if (!booking || cancelled || completed) {
      setLazyReminderJobs(null);
      setLazyReminderJobsLoading(false);
      return;
    }
    if (!reminderJobsLazy) {
      setLazyReminderJobs(null);
      setLazyReminderJobsLoading(false);
      return;
    }
    let cancelledEffect = false;
    setLazyReminderJobs(null);
    setLazyReminderJobsLoading(true);
    void loadBookingReminderJobsAction(tenantId, booking.id, booking.lead_id, adminKey).then((r) => {
      if (cancelledEffect) return;
      setLazyReminderJobsLoading(false);
      if (r.ok) setLazyReminderJobs(r.reminderJobs);
      else setLazyReminderJobs([]);
    });
    return () => {
      cancelledEffect = true;
    };
  }, [adminKey, booking, cancelled, completed, reminderJobsLazy, tenantId]);

  const effectiveReminderJobs = reminderJobsLazy ? (lazyReminderJobs ?? []) : reminderJobs;

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

  const [conflictPreview, setConflictPreview] = useState<BookingConflictPreviewResult | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);

  const conflictPreviewBody = useMemo(() => {
    if (!booking || cancelled || completed) return null;
    const startIso = fromDatetimeLocalValue(startLocal, datetimeTz);
    const endIso = fromDatetimeLocalValue(endLocal, datetimeTz);
    if (!startIso || !endIso) return null;
    return {
      previewIntent: "edit" as const,
      clinicId: clinicId.trim() || null,
      bookingType: bookingType.trim() || null,
      roomId: draftRoomId.trim() || booking.room_id,
      roomRequired: booking.room_required,
      staffId: assignedStaffId.trim() || null,
      bookingId: booking.id,
      startAt: startIso,
      endAt: endIso,
      ...(resourceDraft.length > 0 ? { extraResourceAssignments: resourceDraft } : {}),
    };
  }, [
    assignedStaffId,
    booking,
    bookingType,
    cancelled,
    clinicId,
    completed,
    datetimeTz,
    draftRoomId,
    endLocal,
    resourceDraft,
    startLocal,
  ]);

  useEffect(() => {
    if (!conflictPreviewBody) {
      setConflictPreview(null);
      setConflictLoading(false);
      return;
    }
    let cancelledEffect = false;
    setConflictLoading(true);
    const t = window.setTimeout(() => {
      void (async () => {
        const r = await previewBookingConflictsAction(tenantId, conflictPreviewBody);
        if (cancelledEffect) return;
        setConflictPreview(r.ok ? r.preview : null);
        setConflictLoading(false);
      })();
    }, 350);
    return () => {
      cancelledEffect = true;
      window.clearTimeout(t);
    };
  }, [tenantId, conflictPreviewBody]);

  const nextSlotsRequest = useMemo(() => {
    if (!booking || cancelled || completed || !clinicId.trim()) return null;
    const startIso = fromDatetimeLocalValue(startLocal, datetimeTz);
    if (!startIso) return null;
    const endIso = fromDatetimeLocalValue(endLocal, datetimeTz);
    const dur =
      (endIso ? bookingDurationMinutesUtc(startIso, endIso) : null) ??
      defaultProcedureDurationMinutes(bookingType, services);
    if (!dur || dur < 1) return null;
    return {
      clinicId: clinicId.trim(),
      bookingType: bookingType.trim() || null,
      staffId: assignedStaffId.trim() || null,
      roomId: (draftRoomId.trim() || booking.room_id?.trim()) || null,
      bookingId: booking.id,
      preferredStartAt: startIso,
      durationMinutes: dur,
    };
  }, [
    assignedStaffId,
    booking,
    bookingType,
    cancelled,
    clinicId,
    completed,
    datetimeTz,
    draftRoomId,
    endLocal,
    services,
    startLocal,
  ]);

  const onApplySuggestedSlot = (slot: NextAvailableBookingSlot) => {
    setStartLocal(toDatetimeLocalValue(slot.startAt, datetimeTz));
    setEndLocal(toDatetimeLocalValue(slot.endAt, datetimeTz));
    setDraftRoomId(slot.roomId);
    if (slot.staffId) setAssignedStaffId(slot.staffId);
  };

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
          roomId: draftRoomId.trim() || null,
          roomRequired: booking.room_required,
          assignedStaffId: assignedStaffId.trim() || null,
          metadata: booking.metadata ?? {},
          ...(resourceDraftHydrated ? { resourceAssignments: resourceDraft } : {}),
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

  const displayTz = normalizeCalendarTimezone(clinicCalendarTimezone ?? booking.timezone);

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
                <p className="mt-1 text-gray-700">
                  Cancelled at: {formatIsoDateTimeInTimezone(booking.cancelled_at, displayTz)}
                </p>
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
                Assigned staff
                <StaffClinicalSelect
                  tenantId={tenantId}
                  options={clinicalStaffOptions}
                  value={assignedStaffId}
                  onChange={setAssignedStaffId}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                />
              </label>
              <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs">
                <p className="font-semibold text-gray-900">Supporting staff & rooms</p>
                <p className="mt-1 text-gray-600">
                  Extra team members and rooms (multi-resource). Primary provider and primary room stay in the fields
                  above.
                </p>
                {resourceDraft.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {resourceDraft.map((x, idx) => (
                      <li
                        key={`${x.resource_type}-${x.resource_id}-${idx}`}
                        className="flex items-center justify-between gap-2 border-t border-gray-200 pt-1 first:border-0 first:pt-0"
                      >
                        <span>
                          {x.resource_type === "staff" ? "Staff" : "Room"}:{" "}
                          {x.resource_type === "staff"
                            ? clinicalStaffOptions.find((s) => s.id === x.resource_id)?.full_name?.trim() ||
                              x.resource_id.slice(0, 8)
                            : x.resource_id.slice(0, 8)}
                        </span>
                        <button
                          type="button"
                          className="text-rose-600 hover:underline"
                          onClick={() => setResourceDraft((d) => d.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-gray-500">No extra resources assigned.</p>
                )}
                <div className="mt-2">
                  <p className="text-[11px] font-medium text-gray-700">Add supporting staff</p>
                  <select
                    className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                    defaultValue=""
                    onChange={(e) => {
                      const id = e.target.value.trim();
                      e.currentTarget.value = "";
                      if (!id) return;
                      if (id === assignedStaffId.trim()) return;
                      if (resourceDraft.some((r) => r.resource_type === "staff" && r.resource_id === id)) return;
                      setResourceDraft((d) => [...d, { resource_type: "staff", resource_id: id, role_label: null }]);
                    }}
                  >
                    <option value="">Select staff to add…</option>
                    {clinicalStaffOptions
                      .filter((s) => canSelectStaffForClinicalPicker(s))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name?.trim() || s.email?.trim() || s.id.slice(0, 8)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <BookingConflictPreview
                preview={conflictPreview}
                loading={conflictLoading && !conflictPreview}
                variant="light"
              />
              <NextAvailableBookingSlots
                tenantId={tenantId}
                calendarTimezone={displayTz}
                request={nextSlotsRequest}
                show={Boolean(conflictPreviewBody) && conflictPreview?.status === "blocked"}
                onApplySlot={onApplySuggestedSlot}
                variant="light"
              />
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
          {reminderJobsLazy && lazyReminderJobsLoading ? (
            <p className="text-xs text-gray-500">Loading reminders…</p>
          ) : null}
          {effectiveReminderJobs.length > 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
              <p className="font-semibold text-gray-900">Reminder queue</p>
              <ul className="mt-2 space-y-1">
                {effectiveReminderJobs.map((j) => (
                  <li key={j.id} className="flex flex-wrap justify-between gap-1 border-t border-gray-200 pt-1 first:border-0 first:pt-0">
                    <span className="font-medium">{j.template_name || "Template"}</span>
                    <span className="text-gray-600">
                      {j.template_type} · {j.template_trigger_event}
                    </span>
                    <span className="w-full text-gray-600 sm:w-auto">
                      {j.status} · scheduled {formatIsoDateTimeInTimezone(j.scheduled_at, displayTz)}
                    </span>
                    {j.error_log?.trim() && (j.status === "failed" || j.status === "cancelled") ? (
                      <span className="w-full text-[11px] text-amber-800">{j.error_log}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : booking.patient_id && !lazyReminderJobsLoading ? (
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
