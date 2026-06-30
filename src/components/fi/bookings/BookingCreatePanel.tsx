"use client";

import { useMemo, useState } from "react";
import { createBookingAction, updateBookingAction } from "@/lib/actions/fi-booking-actions";
import { BOOKING_TYPES } from "@/src/lib/bookings";
import {
  serviceForBookingType,
  formatPriceAud,
  defaultProcedureDurationMinutes,
} from "@/src/lib/bookings/servicesCatalog";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type {
  CrmShellClinicOption,
  CrmShellUserPickerOption,
  FiCrmLeadRow,
} from "@/src/lib/crm/types";
import {
  defaultRangeIso,
  endLocalFromStartLocalAndProcedure,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "./bookingFormUtils";
import { displayCalendarTimezoneSubtitle } from "@/src/lib/calendar/calendarTimezone";

const card =
  "rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40";

export function BookingCreatePanel({
  tenantId,
  lead,
  mode,
  initialBooking,
  assigneeOptions,
  clinicOptions,
  adminKey,
  calendarTimezone,
  services = [],
  onCancelEdit,
  onSuccess,
}: {
  tenantId: string;
  lead: FiCrmLeadRow;
  mode: "create" | "edit";
  initialBooking: FiBookingRow | null;
  assigneeOptions: CrmShellUserPickerOption[];
  clinicOptions: CrmShellClinicOption[];
  adminKey: string;
  /** Tenant default from `fi_tenant_settings.default_timezone`. */
  calendarTimezone?: string | null;
  /** Tenant procedure catalog — drives default duration / end time. */
  services?: FiServiceRow[];
  onCancelEdit: () => void;
  onSuccess: () => void;
}) {
  const converted = Boolean(lead.converted_at?.trim());
  const clinicTz = calendarTimezone?.trim() || null;
  const def = useMemo(() => defaultRangeIso(clinicTz), [clinicTz]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [bookingType, setBookingType] = useState(initialBooking?.booking_type ?? "consultation");
  const [title, setTitle] = useState(initialBooking?.title ?? "");
  const [description, setDescription] = useState(initialBooking?.description ?? "");
  const [startLocal, setStartLocal] = useState(() =>
    toDatetimeLocalValue(initialBooking?.start_at ?? def.start, clinicTz)
  );
  const [endLocal, setEndLocal] = useState(() =>
    toDatetimeLocalValue(initialBooking?.end_at ?? def.end, clinicTz)
  );
  const [timezone, setTimezone] = useState(initialBooking?.timezone ?? clinicTz ?? "");
  const [location, setLocation] = useState(initialBooking?.location ?? "");
  const [assignee, setAssignee] = useState(initialBooking?.assigned_user_id ?? "");
  const [clinicId, setClinicId] = useState(initialBooking?.clinic_id ?? "");

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  const typeOptions = useMemo(() => {
    const u = new Set<string>([...BOOKING_TYPES]);
    if (bookingType?.trim()) u.add(bookingType.trim());
    return Array.from(u);
  }, [bookingType]);

  const selectedCatalog = useMemo(
    () => serviceForBookingType(services, bookingType),
    [services, bookingType]
  );

  function wallClockTz(): string | null {
    return clinicTz || timezone.trim() || null;
  }

  function onProcedureTypeChange(nextType: string) {
    setBookingType(nextType);
    const nextEnd = endLocalFromStartLocalAndProcedure(
      startLocal,
      nextType,
      wallClockTz(),
      services
    );
    if (nextEnd) setEndLocal(nextEnd);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const startIso = fromDatetimeLocalValue(startLocal, wallClockTz());
      const endIso = fromDatetimeLocalValue(endLocal, wallClockTz());
      if (!startIso || !endIso) {
        setFeedback("Start and end times are required.");
        return;
      }

      const base = {
        bookingType: converted ? bookingType : "consultation",
        title: title.trim() || null,
        description: description.trim() || null,
        startAt: startIso,
        endAt: endIso,
        timezone: timezone.trim() || null,
        location: location.trim() || null,
        metadata: {},
        leadId: lead.id,
        personId: converted ? lead.person_id : null,
        patientId: converted && lead.patient_id ? lead.patient_id : null,
        caseId: converted && lead.case_id ? lead.case_id : null,
        clinicId: clinicId.trim() || null,
        assignedUserId: assignee.trim() || null,
      };

      if (mode === "create") {
        const r = await createBookingAction(tenantId, withAdmin(base));
        if (!r.ok) setFeedback(r.error);
        else {
          onSuccess();
          setTitle("");
          setDescription("");
          const d = defaultRangeIso(clinicTz);
          setStartLocal(toDatetimeLocalValue(d.start, clinicTz));
          setEndLocal(toDatetimeLocalValue(d.end, clinicTz));
        }
      } else if (initialBooking) {
        const r = await updateBookingAction(
          tenantId,
          initialBooking.id,
          withAdmin({
            ...base,
            bookingStatus: initialBooking.booking_status,
          })
        );
        if (!r.ok) setFeedback(r.error);
        else {
          onSuccess();
          onCancelEdit();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <h3 className="text-sm font-semibold text-slate-100">
        {mode === "create" ? "New booking" : "Edit booking"}
      </h3>
      <form className="mt-3 space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <label className="block text-xs text-slate-400">
          Type
          <select
            className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-sm disabled:bg-white/[0.06]"
            value={converted ? bookingType : "consultation"}
            disabled={!converted}
            onChange={(ev) => onProcedureTypeChange(ev.target.value)}
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {bookingTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        {!converted ? (
          <p className="text-xs text-gray-500">Only consultation is available before conversion.</p>
        ) : null}
        <label className="block text-xs text-slate-400">
          Title
          <input
            className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-sm"
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Description
          <textarea
            className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-sm"
            rows={2}
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Start{clinicTz ? ` (${displayCalendarTimezoneSubtitle(clinicTz)})` : ""}
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-sm"
              value={startLocal}
              onChange={(ev) => setStartLocal(ev.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-400">
            End{clinicTz ? ` (${displayCalendarTimezoneSubtitle(clinicTz)})` : ""}
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-sm"
              value={endLocal}
              onChange={(ev) => setEndLocal(ev.target.value)}
            />
            {converted ? (
              <p className="mt-1 text-[11px] text-gray-500">
                Default slot for this procedure type:{" "}
                {defaultProcedureDurationMinutes(bookingType, services)} min (end updates when you
                change type).
                {selectedCatalog && selectedCatalog.base_price > 0 ? (
                  <> Suggested price: {formatPriceAud(selectedCatalog.base_price)}.</>
                ) : null}
              </p>
            ) : null}
          </label>
        </div>
        <label className="block text-xs text-slate-400">
          Timezone override (optional)
          <input
            className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-sm"
            value={timezone}
            onChange={(ev) => setTimezone(ev.target.value)}
            placeholder="e.g. Europe/London"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Location (optional)
          <input
            className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-sm"
            value={location}
            onChange={(ev) => setLocation(ev.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Clinic (optional)
          <select
            className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-sm"
            value={clinicId}
            onChange={(ev) => setClinicId(ev.target.value)}
          >
            <option value="">—</option>
            {clinicOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Assigned user (optional)
          <select
            className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-sm"
            value={assignee}
            onChange={(ev) => setAssignee(ev.target.value)}
          >
            <option value="">—</option>
            {assigneeOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email?.trim() || u.id}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={busy}
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
          {mode === "edit" ? (
            <button
              type="button"
              className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/[0.03]"
              disabled={busy}
              onClick={onCancelEdit}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        {feedback ? <p className="text-xs text-rose-300">{feedback}</p> : null}
      </form>
    </div>
  );
}
