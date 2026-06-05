"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBookingAction } from "@/lib/actions/fi-booking-actions";
import { BOOKING_TYPES } from "@/src/lib/bookings";
import {
  checkAppointmentAvailability,
  DEFAULT_APPOINTMENT_BUFFER_MINUTES,
} from "@/src/lib/bookings/appointmentAvailability";
import type { AppointmentCreatePrefill } from "@/src/lib/bookings/appointmentCreateTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/src/components/fi/bookings/bookingFormUtils";
import { appointmentCardClass } from "./shared";

export function AppointmentCreateSlideOver({
  tenantId,
  prefill,
  assignees,
  clinics,
  existingBookings,
  onClose,
  onCreated,
}: {
  tenantId: string;
  prefill: AppointmentCreatePrefill;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  existingBookings: FiBookingRow[];
  onClose: () => void;
  onCreated: (bookingId: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityHint, setAvailabilityHint] = useState<string | null>(null);

  const [bookingType, setBookingType] = useState(prefill.bookingType || "consultation");
  const [title, setTitle] = useState(prefill.title ?? "");
  const [startLocal, setStartLocal] = useState(toDatetimeLocalValue(prefill.startIso));
  const [endLocal, setEndLocal] = useState(toDatetimeLocalValue(prefill.endIso));
  const [assignee, setAssignee] = useState(prefill.assignedUserId ?? "");
  const [clinicId, setClinicId] = useState(prefill.clinicId ?? "");
  const [location, setLocation] = useState("");

  useEffect(() => {
    setBookingType(prefill.bookingType || "consultation");
    setTitle(prefill.title ?? "");
    setStartLocal(toDatetimeLocalValue(prefill.startIso));
    setEndLocal(toDatetimeLocalValue(prefill.endIso));
    setAssignee(prefill.assignedUserId ?? "");
    setClinicId(prefill.clinicId ?? "");
    setError(null);
  }, [prefill]);

  const typeOptions = useMemo(() => {
    const u = new Set<string>([...BOOKING_TYPES]);
    if (bookingType.trim()) u.add(bookingType.trim());
    return Array.from(u);
  }, [bookingType]);

  function runAvailabilityCheck(): boolean {
    const startIso = fromDatetimeLocalValue(startLocal);
    const endIso = fromDatetimeLocalValue(endLocal);
    if (!startIso || !endIso) {
      setAvailabilityHint("Set valid start and end times to check availability.");
      return false;
    }
    const r = checkAppointmentAvailability({
      candidateStartIso: startIso,
      candidateEndIso: endIso,
      assignedUserId: assignee.trim() || null,
      existing: existingBookings,
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
    const startIso = fromDatetimeLocalValue(startLocal);
    const endIso = fromDatetimeLocalValue(endLocal);
    if (!startIso || !endIso) {
      setError("Start and end times are required.");
      return;
    }
    const avail = checkAppointmentAvailability({
      candidateStartIso: startIso,
      candidateEndIso: endIso,
      assignedUserId: assignee.trim() || null,
      existing: existingBookings,
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
        assignedUserId: assignee.trim() || null,
        clinicId: clinicId.trim() || null,
        location: location.trim() || null,
        timezone: null,
        description: null,
        metadata: {},
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">New appointment</h3>
        <p className="mt-1 text-xs text-gray-600">
          Pre-filled from your current context. Availability uses a {DEFAULT_APPOINTMENT_BUFFER_MINUTES}-minute buffer
          around existing bookings for the selected staff member.
        </p>
      </section>

      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block text-xs text-gray-600">
          Procedure type
          <select
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={bookingType}
            onChange={(e) => setBookingType(e.target.value)}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          Title
          <input
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Consultation — …"
          />
        </label>
        <label className="block text-xs text-gray-600">
          Start
          <input
            type="datetime-local"
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={startLocal}
            onChange={(e) => {
              setStartLocal(e.target.value);
              setAvailabilityHint(null);
            }}
          />
        </label>
        <label className="block text-xs text-gray-600">
          End
          <input
            type="datetime-local"
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={endLocal}
            onChange={(e) => {
              setEndLocal(e.target.value);
              setAvailabilityHint(null);
            }}
          />
        </label>
        <label className="block text-xs text-gray-600">
          Staff
          <select
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={assignee}
            onChange={(e) => {
              setAssignee(e.target.value);
              setAvailabilityHint(null);
            }}
          >
            <option value="">Unassigned</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email?.trim() || u.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          Clinic
          <select
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
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
        <label className="block text-xs text-gray-600">
          Location note
          <input
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
            onClick={() => runAvailabilityCheck()}
          >
            Check availability
          </button>
        </div>
        {availabilityHint ? (
          <p className={`text-xs ${availabilityHint.startsWith("Slot is") ? "text-emerald-800" : "text-amber-900"}`}>
            {availabilityHint}
          </p>
        ) : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}

        <div className="flex gap-2 border-t border-gray-100 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create appointment"}
          </button>
          <button type="button" className="text-sm text-gray-600 hover:text-gray-900" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
