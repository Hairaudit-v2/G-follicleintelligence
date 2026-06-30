"use client";

import { useEffect, useMemo, useState } from "react";
import { createBookingAction } from "@/lib/actions/fi-booking-actions";
import { BOOKING_TYPES } from "@/src/lib/bookings";
import {
  defaultProcedureDurationMinutes,
  formatPriceAud,
  serviceForBookingType,
} from "@/src/lib/bookings/servicesCatalog";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";
import { StaffClinicalSelect } from "@/src/components/fi/staff/StaffClinicalPickerFields";
import { canSelectStaffForClinicalPicker, type ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import {
  defaultRangeIso,
  endLocalFromStartLocalAndProcedure,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/src/components/fi/bookings/bookingFormUtils";
import { displayCalendarTimezoneSubtitle } from "@/src/lib/calendar/calendarTimezone";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

const card = "rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40";

export function BookingQuickCreatePanel({
  tenantId,
  clinicalStaffOptions,
  clinics,
  adminKey,
  onCreated,
  slotPrefill,
  calendarTimezone,
  services = [],
}: {
  tenantId: string;
  clinicalStaffOptions: ClinicalStaffPickerOption[];
  clinics: CrmShellClinicOption[];
  adminKey: string;
  onCreated: () => void;
  slotPrefill?: { startIso: string; endIso: string } | null;
  calendarTimezone?: string | null;
  services?: FiServiceRow[];
}) {
  const tz = calendarTimezone?.trim() || null;
  const def = useMemo(() => defaultRangeIso(tz), [tz]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [bookingType, setBookingType] = useState("consultation");
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState(() => toDatetimeLocalValue(def.start, tz));
  const [endLocal, setEndLocal] = useState(() => toDatetimeLocalValue(def.end, tz));
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [location, setLocation] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [anchorKind, setAnchorKind] = useState<"lead" | "person" | "patient" | "case">("lead");
  const [anchorId, setAnchorId] = useState("");

  useEffect(() => {
    if (!slotPrefill) return;
    setStartLocal(toDatetimeLocalValue(slotPrefill.startIso, tz));
    setEndLocal(toDatetimeLocalValue(slotPrefill.endIso, tz));
  }, [slotPrefill, tz]);

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

  const selectedStaff = useMemo(
    () => clinicalStaffOptions.find((o) => o.id === assignedStaffId.trim()) ?? null,
    [clinicalStaffOptions, assignedStaffId]
  );

  function onProcedureTypeChange(nextType: string) {
    setBookingType(nextType);
    const nextEnd = endLocalFromStartLocalAndProcedure(startLocal, nextType, tz, services);
    if (nextEnd) setEndLocal(nextEnd);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const startIso = fromDatetimeLocalValue(startLocal, tz);
      const endIso = fromDatetimeLocalValue(endLocal, tz);
      if (!startIso || !endIso) {
        setFeedback("Start and end times are required.");
        return;
      }
      const aid = anchorId.trim();
      if (!isUuid(aid)) {
        setFeedback("Enter a valid UUID for the selected anchor.");
        return;
      }
      const sid = assignedStaffId.trim();
      if (sid && selectedStaff && !canSelectStaffForClinicalPicker(selectedStaff)) {
        setFeedback(selectedStaff.clinical_readiness.block_reason ?? "Selected staff is not clinically available.");
        return;
      }

      const anchors =
        anchorKind === "lead"
          ? { leadId: aid, personId: null, patientId: null, caseId: null }
          : anchorKind === "person"
            ? { leadId: null, personId: aid, patientId: null, caseId: null }
            : anchorKind === "patient"
              ? { leadId: null, personId: null, patientId: aid, caseId: null }
              : { leadId: null, personId: null, patientId: null, caseId: aid };

      const r = await createBookingAction(
        tenantId,
        withAdmin({
          ...anchors,
          bookingType,
          title: title.trim() || null,
          startAt: startIso,
          endAt: endIso,
          assignedStaffId: sid || null,
          location: location.trim() || null,
          clinicId: clinicId.trim() || null,
          timezone: tz,
          description: null,
          metadata: {},
        })
      );
      if (!r.ok) setFeedback(r.error);
      else {
        onCreated();
        setTitle("");
        setAnchorId("");
        setAssignedStaffId("");
        const d = defaultRangeIso(tz);
        setStartLocal(toDatetimeLocalValue(d.start, tz));
        setEndLocal(toDatetimeLocalValue(d.end, tz));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-slate-100">Quick create</h2>
      <p className="mt-1 text-xs text-slate-400">
        Paste an existing UUID for a lead, person, patient, or case anchor (no search yet). Consultation-only rules apply
        when the anchor is a non-converted lead.
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Anchor
          <div className="mt-1 flex flex-wrap gap-2">
            <select
              value={anchorKind}
              onChange={(e) => setAnchorKind(e.target.value as typeof anchorKind)}
              className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm"
            >
              <option value="lead">Lead ID</option>
              <option value="person">Person ID</option>
              <option value="patient">Patient ID</option>
              <option value="case">Case ID</option>
            </select>
            <input
              value={anchorId}
              onChange={(e) => setAnchorId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="min-w-[16rem] flex-1 rounded border border-slate-700 px-2 py-1 font-mono text-sm"
            />
          </div>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Type
          <select
            value={bookingType}
            onChange={(e) => onProcedureTypeChange(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm"
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {bookingTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Title (optional)
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Start{tz ? ` (${displayCalendarTimezoneSubtitle(tz)})` : " (device)"}
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          End{tz ? ` (${displayCalendarTimezoneSubtitle(tz)})` : " (device)"}
          <input
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 px-2 py-1 text-sm"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Default slot for this procedure type: {defaultProcedureDurationMinutes(bookingType, services)} min (end
            updates when you change type).
            {selectedCatalog && selectedCatalog.base_price > 0 ? (
              <> Suggested price: {formatPriceAud(selectedCatalog.base_price)}.</>
            ) : null}
          </p>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Clinical provider
          <StaffClinicalSelect
            tenantId={tenantId}
            options={clinicalStaffOptions}
            value={assignedStaffId}
            onChange={setAssignedStaffId}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Clinic (optional)
          <select
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm"
          >
            <option value="">None</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Location text (optional)
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 px-2 py-1 text-sm"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create booking"}
          </button>
        </div>
        {feedback ? <p className="sm:col-span-2 text-sm text-rose-300">{feedback}</p> : null}
      </form>
    </div>
  );
}
