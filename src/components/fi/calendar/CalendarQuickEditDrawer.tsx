/**
 * FI-CALENDAR-WRITEBACK-1A — Quick Edit drawer for editable calendar events.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import {
  convertExternalCalendarEventRequest,
  linkCalendarOsPatientRequest,
  quickEditCalendarOsEventRequest,
} from "@/lib/calendar/appointmentsApiClient";
import { rescheduleCalendarAppointmentRequest } from "@/lib/calendar/appointmentsApiClient";
import { isCalendarOsEventRow } from "@/src/lib/calendar/calendarOsEventsCore";
import {
  calendarEventClassificationLabel,
  PATIENT_NOT_LINKED_LABEL,
  type CalendarEventClassification,
} from "@/src/lib/calendar/calendarEventClassification";
import type { CalendarEventEditPolicy } from "@/src/lib/calendar/calendarEventEditPolicy";
import { normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { cn } from "@/lib/utils";

function toLocalInputValue(iso: string, tz: string): string {
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return iso.slice(0, 16);
  }
}

export function CalendarQuickEditDrawer({
  tenantId,
  booking,
  policy,
  classification,
  clinics,
  staffDirectory,
  calendarTimezone,
  externalTitle,
  googleHtmlLink,
  fiosAppointmentId,
  patientNotLinked,
  onClose,
  onSaved,
  onOpenFull,
}: {
  tenantId: string;
  booking: FiBookingRow;
  policy: CalendarEventEditPolicy;
  classification: CalendarEventClassification;
  clinics: CrmShellClinicOption[];
  staffDirectory: CrmShellUserPickerOption[];
  calendarTimezone?: string | null;
  externalTitle?: string | null;
  googleHtmlLink?: string | null;
  fiosAppointmentId?: string | null;
  patientNotLinked?: boolean;
  onClose: () => void;
  onSaved: () => void;
  onOpenFull: (b: FiBookingRow) => void;
}) {
  const tz = normalizeCalendarTimezone(calendarTimezone ?? booking.timezone);
  const startMs = Date.parse(booking.start_at);
  const endMs = Date.parse(booking.end_at);
  const durationMin =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(5, Math.round((endMs - startMs) / 60000))
      : 30;

  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState(booking.patient_id ?? "");
  const [confirmLink, setConfirmLink] = useState(false);
  const [appointmentType, setAppointmentType] = useState(booking.booking_type);
  const [clinicId, setClinicId] = useState(booking.clinic_id ?? "");
  const [staffId, setStaffId] = useState(booking.assigned_staff_id ?? "");
  const [room, setRoom] = useState(booking.location ?? "");
  const [startLocal, setStartLocal] = useState(toLocalInputValue(booking.start_at, tz));
  const [duration, setDuration] = useState(String(durationMin));
  const [status, setStatus] = useState(booking.booking_status);
  const [notes, setNotes] = useState(booking.description ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const actions = new Set(policy.drawerActions);
  const editable = policy.canQuickEdit;

  async function onSave() {
    if (!editable) return;
    setBusy(true);
    setFeedback(null);
    try {
      const startDate = new Date(startLocal);
      const dur = Math.max(5, Number(duration) || durationMin);
      if (Number.isNaN(startDate.getTime())) {
        setFeedback("Invalid start date/time.");
        return;
      }
      const endIso = new Date(startDate.getTime() + dur * 60_000).toISOString();
      const startIso = startDate.toISOString();

      if (isCalendarOsEventRow(booking)) {
        const r = await quickEditCalendarOsEventRequest({
          tenantId,
          eventId: booking.id,
          patch: {
            startAt: startIso,
            endAt: endIso,
            eventType: appointmentType,
            clinicId: clinicId || null,
            staffId: staffId || null,
            location: room || null,
            status,
            notes: notes || null,
            title: booking.title,
          },
        });
        if (!r.ok) {
          setFeedback(r.error);
          return;
        }
      } else {
        const r = await rescheduleCalendarAppointmentRequest({
          tenantId,
          appointmentId: booking.id,
          startAt: startIso,
          endAt: endIso,
          staffId: staffId || null,
          clinicId: clinicId || null,
          procedure: appointmentType,
          metadata: { ...(booking.metadata ?? {}), status, notes },
        });
        if (!r.ok) {
          setFeedback(r.error);
          return;
        }
      }
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function onLinkPatient() {
    if (!patientId.trim() || !confirmLink) {
      setFeedback("Select a patient and confirm before linking.");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const r = await linkCalendarOsPatientRequest({
        tenantId,
        eventId: booking.id,
        patientId: patientId.trim(),
        confirmed: true,
      });
      if (!r.ok) {
        setFeedback(r.error);
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function onConvert() {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await convertExternalCalendarEventRequest({
        tenantId,
        eventId: booking.id,
        clinicId: clinicId || null,
        assignedStaffId: staffId || null,
      });
      if (!r.ok) {
        setFeedback(r.error);
        return;
      }
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/40";
  const labelClass = "text-[10px] font-medium uppercase tracking-wide text-slate-500";
  const btnClass =
    "inline-flex w-full items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.05] px-2 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/[0.09] disabled:opacity-40";

  return (
    <div
      className={cn(fiOsChromeClasses.rightDrawerOverlay, "z-[195] bg-black/55 backdrop-blur-[3px]")}
      role="presentation"
      onClick={onClose}
    >
      <aside
        className={cn(
          fiOsChromeClasses.rightDrawerPanel,
          "border-l border-white/[0.08] bg-[#070f1a]/96 text-slate-100 shadow-2xl backdrop-blur-xl sm:max-w-sm"
        )}
        role="dialog"
        aria-label="Quick edit appointment"
        data-testid="calendar-quick-edit-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className={cn(fiOsChromeClasses.rightDrawerHeader, "border-b border-white/[0.08] px-3 py-3")}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-[15px] font-semibold text-slate-50">
                {patientNotLinked ? PATIENT_NOT_LINKED_LABEL : booking.title}
              </p>
              <p className="text-[11px] text-slate-500">
                {calendarEventClassificationLabel(classification)}
                {policy.showSyncStatus ? " · sync visible" : ""}
              </p>
              {externalTitle ? (
                <p className="truncate text-[11px] text-slate-400">External title: {externalTitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </header>

        <div className={cn(fiOsChromeClasses.rightDrawerBodyScroll, "space-y-3 px-3 py-3")}>
          {policy.readOnlyExplanation ? (
            <p className="rounded-md border border-amber-500/25 bg-amber-950/30 px-2.5 py-2 text-[11px] text-amber-100/90">
              {policy.readOnlyExplanation}
            </p>
          ) : null}

          {policy.showExternalBadge ? (
            <p className="rounded-md border border-violet-500/30 bg-violet-950/35 px-2.5 py-2 text-[11px] text-violet-100">
              External event — not a normal FiOS appointment until linked or converted.
            </p>
          ) : null}

          {editable ? (
            <>
              <label className="block">
                <span className={labelClass}>Appointment type</span>
                <input
                  className={fieldClass}
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Clinic</span>
                <select
                  className={fieldClass}
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
              <label className="block">
                <span className={labelClass}>Clinician</span>
                <select
                  className={fieldClass}
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {staffDirectory.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name?.trim() || s.email?.trim() || s.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Room / location</span>
                <input className={fieldClass} value={room} onChange={(e) => setRoom(e.target.value)} />
              </label>
              <label className="block">
                <span className={labelClass}>Start</span>
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Duration (minutes)</span>
                <input
                  type="number"
                  min={5}
                  className={fieldClass}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Status</span>
                <input className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)} />
              </label>
              <label className="block">
                <span className={labelClass}>Notes</span>
                <textarea
                  className={cn(fieldClass, "min-h-[72px]")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </>
          ) : null}

          {actions.has("link_patient") ? (
            <div className="space-y-2 rounded-md border border-white/[0.08] p-2">
              <p className={labelClass}>Link patient</p>
              <input
                className={fieldClass}
                placeholder="Patient UUID (search UI hooks to CRM next)"
                value={patientSearch || patientId}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setPatientId(e.target.value);
                }}
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={confirmLink}
                  onChange={(e) => setConfirmLink(e.target.checked)}
                />
                I confirm this patient link (no name-only auto-match)
              </label>
              <button
                type="button"
                className={btnClass}
                disabled={busy}
                onClick={() => void onLinkPatient()}
              >
                Link patient
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {actions.has("save") && editable ? (
              <button type="button" className={btnClass} disabled={busy} onClick={() => void onSave()}>
                Save
              </button>
            ) : null}
            {actions.has("cancel") ? (
              <button type="button" className={btnClass} disabled={busy} onClick={onClose}>
                Cancel
              </button>
            ) : null}
            {actions.has("open_full_appointment") ? (
              <button
                type="button"
                className={btnClass}
                disabled={busy}
                onClick={() => {
                  onOpenFull(booking);
                  onClose();
                }}
              >
                Open full appointment
              </button>
            ) : null}
            {actions.has("open_in_google_calendar") && googleHtmlLink ? (
              <a
                href={googleHtmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className={btnClass}
              >
                Open in Google Calendar
              </a>
            ) : null}
            {actions.has("convert_to_fios_appointment") ? (
              <button
                type="button"
                className={btnClass}
                disabled={busy}
                onClick={() => void onConvert()}
              >
                Convert to FiOS appointment
              </button>
            ) : null}
            {fiosAppointmentId ? (
              <Link
                href={`/fi-admin/${tenantId}/appointments/${fiosAppointmentId}`}
                className={btnClass}
              >
                Open linked booking
              </Link>
            ) : null}
          </div>

          {feedback ? <p className="text-xs text-red-300">{feedback}</p> : null}
        </div>
      </aside>
    </div>
  );
}
