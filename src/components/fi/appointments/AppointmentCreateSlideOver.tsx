"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBookingAction } from "@/lib/actions/fi-booking-actions";
import { BOOKING_TYPES } from "@/src/lib/bookings";
import {
  checkAppointmentAvailability,
  DEFAULT_APPOINTMENT_BUFFER_MINUTES,
} from "@/src/lib/bookings/appointmentAvailability";
import {
  defaultProcedureDurationMinutes,
  formatPriceAud,
  serviceForBookingType,
} from "@/src/lib/bookings/servicesCatalog";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { AppointmentCreatePrefill } from "@/src/lib/bookings/appointmentCreateTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";
import { buildStaffBookingAvailabilityHint } from "@/src/lib/staff/staffWeeklyHours";
import { StaffClinicalSelect } from "@/src/components/fi/staff/StaffClinicalPickerFields";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import {
  endLocalFromStartLocalAndProcedure,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/src/components/fi/bookings/bookingFormUtils";
import { appointmentCardClass } from "./shared";
import { staffPickerUserMap } from "./staffPickerMap";

export function AppointmentCreateSlideOver({
  tenantId,
  prefill,
  assignees,
  clinics,
  existingBookings,
  tenantCalendarTimezone,
  services = [],
  onClose,
  onCreated,
}: {
  tenantId: string;
  prefill: AppointmentCreatePrefill;
  assignees: ClinicalStaffPickerOption[];
  clinics: CrmShellClinicOption[];
  existingBookings: FiBookingRow[];
  /** Tenant clinic clock — `datetime-local` values are interpreted in this IANA zone. */
  tenantCalendarTimezone: string;
  services?: FiServiceRow[];
  onClose: () => void;
  onCreated: (bookingId: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityHint, setAvailabilityHint] = useState<string | null>(null);

  const [bookingType, setBookingType] = useState(prefill.bookingType || "consultation");
  const [title, setTitle] = useState(prefill.title ?? "");
  const [startLocal, setStartLocal] = useState(
    toDatetimeLocalValue(prefill.startIso, tenantCalendarTimezone)
  );
  const [endLocal, setEndLocal] = useState(
    toDatetimeLocalValue(prefill.endIso, tenantCalendarTimezone)
  );
  const staffIdToUserId = useMemo(() => staffPickerUserMap(assignees), [assignees]);

  const [assignee, setAssignee] = useState(prefill.assignedStaffId ?? prefill.assignedUserId ?? "");
  const [clinicId, setClinicId] = useState(prefill.clinicId ?? "");
  const [location, setLocation] = useState("");

  const [notesBody, setNotesBody] = useState(prefill.description ?? "");

  const selectedStaff = useMemo(
    () => assignees.find((a) => a.id === assignee.trim()) ?? null,
    [assignees, assignee]
  );

  const staffScheduleHint = useMemo(() => {
    if (!assignee.trim()) {
      return "Select staff to see usual weekly hours (wall times use their default timezone, or Australia/Perth when unset).";
    }
    if (!selectedStaff) return "Staff hours unavailable for this selection.";
    const startIso = fromDatetimeLocalValue(startLocal, tenantCalendarTimezone);
    const endIso = fromDatetimeLocalValue(endLocal, tenantCalendarTimezone);
    return buildStaffBookingAvailabilityHint({
      staffDefaultTimezone: selectedStaff.default_timezone,
      workingHours: selectedStaff.working_hours ?? null,
      tenantCalendarTimezone,
      candidateStartIso: startIso,
      candidateEndIso: endIso,
    });
  }, [assignee, selectedStaff, startLocal, endLocal, tenantCalendarTimezone]);

  useEffect(() => {
    setBookingType(prefill.bookingType || "consultation");
    setTitle(prefill.title ?? "");
    setStartLocal(toDatetimeLocalValue(prefill.startIso, tenantCalendarTimezone));
    setEndLocal(toDatetimeLocalValue(prefill.endIso, tenantCalendarTimezone));
    setAssignee(prefill.assignedStaffId ?? prefill.assignedUserId ?? "");
    setClinicId(prefill.clinicId ?? "");
    setNotesBody(prefill.description ?? "");
    setError(null);
  }, [prefill, tenantCalendarTimezone]);

  const typeOptions = useMemo(() => {
    const u = new Set<string>([...BOOKING_TYPES]);
    if (bookingType.trim()) u.add(bookingType.trim());
    return Array.from(u);
  }, [bookingType]);

  const selectedCatalog = useMemo(
    () => serviceForBookingType(services, bookingType),
    [services, bookingType]
  );

  function onProcedureTypeChange(nextType: string) {
    setBookingType(nextType);
    const nextEnd = endLocalFromStartLocalAndProcedure(
      startLocal,
      nextType,
      tenantCalendarTimezone,
      services
    );
    if (nextEnd) setEndLocal(nextEnd);
    setAvailabilityHint(null);
  }

  function runAvailabilityCheck(): boolean {
    const startIso = fromDatetimeLocalValue(startLocal, tenantCalendarTimezone);
    const endIso = fromDatetimeLocalValue(endLocal, tenantCalendarTimezone);
    if (!startIso || !endIso) {
      setAvailabilityHint("Set valid start and end times to check availability.");
      return false;
    }
    const staffId = assignee.trim() || null;
    const r = checkAppointmentAvailability({
      candidateStartIso: startIso,
      candidateEndIso: endIso,
      candidateStaffId: staffId,
      candidateUserId: null,
      existing: existingBookings,
      staffIdToUserId,
      bufferMinutes: DEFAULT_APPOINTMENT_BUFFER_MINUTES,
    });
    if (!r.ok) {
      setAvailabilityHint(r.message);
      return false;
    }
    setAvailabilityHint("Slot is available (includes buffer).");
    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const startIso = fromDatetimeLocalValue(startLocal, tenantCalendarTimezone);
    const endIso = fromDatetimeLocalValue(endLocal, tenantCalendarTimezone);
    if (!startIso || !endIso) {
      setError("Start and end times are required.");
      return;
    }
    const staffId = assignee.trim() || null;
    const avail = checkAppointmentAvailability({
      candidateStartIso: startIso,
      candidateEndIso: endIso,
      candidateStaffId: staffId,
      candidateUserId: null,
      existing: existingBookings,
      staffIdToUserId,
      bufferMinutes: DEFAULT_APPOINTMENT_BUFFER_MINUTES,
    });
    if (!avail.ok) {
      setError(avail.message);
      return;
    }

    const anchors = {
      leadId: prefill.leadId,
      personId: prefill.personId,
      patientId: prefill.patientId,
      caseId: prefill.caseId,
    };
    const baseMeta =
      prefill.initialMetadata &&
      typeof prefill.initialMetadata === "object" &&
      !Array.isArray(prefill.initialMetadata)
        ? { ...prefill.initialMetadata }
        : {};
    if (!anchors.leadId && !anchors.personId && !anchors.patientId && !anchors.caseId) {
      setError("Link at least one of lead, person, patient, or case before booking.");
      return;
    }

    setBusy(true);
    try {
      const r = await createBookingAction(tenantId, {
        ...anchors,
        bookingType,
        title: title.trim() || null,
        startAt: startIso,
        endAt: endIso,
        assignedStaffId: assignee.trim() || null,
        assignedUserId: null,
        clinicId: clinicId.trim() || null,
        location: location.trim() || null,
        timezone: null,
        description: notesBody.trim() || null,
        metadata: baseMeta,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onCreated(r.booking.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className={appointmentCardClass}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          New appointment
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Pre-filled from your current context. Start/end use the clinic timezone (
          {tenantCalendarTimezone}). Availability uses a {DEFAULT_APPOINTMENT_BUFFER_MINUTES}-minute
          buffer around existing bookings for the selected staff member.
        </p>
      </section>

      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block text-xs text-slate-400">
          Procedure type
          <select
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            value={bookingType}
            onChange={(e) => onProcedureTypeChange(e.target.value)}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {bookingTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Title
          <input
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Consultation — …"
          />
        </label>
        {prefill.consultationId?.trim() ? (
          <p className="text-[11px] text-slate-400">
            Linked consultation{" "}
            <Link
              href={`/fi-admin/${tenantId}/consultations/${encodeURIComponent(prefill.consultationId.trim())}`}
              className="font-semibold text-blue-300 underline"
            >
              open record
            </Link>
            .
          </p>
        ) : null}
        <label className="block text-xs text-slate-400">
          Clinical / scheduling notes
          <textarea
            className="mt-0.5 min-h-[120px] w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            value={notesBody}
            onChange={(e) => setNotesBody(e.target.value)}
            placeholder="Optional — pre-filled when scheduling from a quote."
          />
        </label>
        <label className="block text-xs text-slate-400">
          Start
          <input
            type="datetime-local"
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            value={startLocal}
            onChange={(e) => {
              setStartLocal(e.target.value);
              setAvailabilityHint(null);
            }}
          />
        </label>
        <label className="block text-xs text-slate-400">
          End
          <input
            type="datetime-local"
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            value={endLocal}
            onChange={(e) => {
              setEndLocal(e.target.value);
              setAvailabilityHint(null);
            }}
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Default slot for this procedure type:{" "}
            {defaultProcedureDurationMinutes(bookingType, services)} min (end updates when you
            change type).
            {selectedCatalog && selectedCatalog.base_price > 0 ? (
              <> Suggested price: {formatPriceAud(selectedCatalog.base_price)}.</>
            ) : null}
          </p>
        </label>
        <label className="block text-xs text-slate-400">
          Staff
          <StaffClinicalSelect
            tenantId={tenantId}
            options={assignees}
            value={assignee}
            onChange={(v) => {
              setAssignee(v);
              setAvailabilityHint(null);
            }}
          />
          <p className="mt-1 text-[11px] leading-snug text-slate-400">{staffScheduleHint}</p>
        </label>
        <label className="block text-xs text-slate-400">
          Clinic
          <select
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
          >
            <option value="">—</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Location note
          <input
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-white/[0.03]"
            onClick={() => runAvailabilityCheck()}
          >
            Check availability
          </button>
        </div>
        {availabilityHint ? (
          <p
            className={`text-xs ${availabilityHint.startsWith("Slot is") ? "text-emerald-300" : "text-amber-200"}`}
          >
            {availabilityHint}
          </p>
        ) : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}

        <div className="flex gap-2 border-t border-white/[0.06] pt-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create appointment"}
          </button>
          <button
            type="button"
            className="text-sm text-slate-400 hover:text-slate-100"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
