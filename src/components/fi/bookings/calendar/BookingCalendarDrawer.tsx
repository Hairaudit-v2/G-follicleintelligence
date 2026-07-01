"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cancelBookingAction,
  completeBookingAction,
  updateBookingAction,
} from "@/lib/actions/fi-booking-actions";
import { createConsultationFromBookingAction } from "@/lib/actions/fi-consultation-actions";
import { isBookingCancelled } from "@/src/lib/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { BookingStatusBadge } from "@/src/components/fi/bookings/operator/BookingStatusBadge";
import { BookingTypeBadge } from "@/src/components/fi/bookings/operator/BookingTypeBadge";
import { normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { bookingAssignmentDisplay } from "@/src/lib/staff/staffAssigneeDisplay";
import { ClinicalStaffingStatusCard } from "@/src/components/fi/workforce/ClinicalStaffingStatusCard";
import type { ClinicalStaffingSummaryDto } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";
import { isCalendarOsEventRow } from "@/src/lib/calendar/calendarOsEventsCore";
import type { CalendarBookingIntelligence } from "@/src/lib/calendarIntelligence/calendarIntelligenceTypes";

function clinicName(clinics: CrmShellClinicOption[], row: FiBookingRow): string {
  if (row.clinic_id) {
    const c = clinics.find((x) => x.id === row.clinic_id);
    if (c) return c.display_name;
    return row.clinic_id.slice(0, 8);
  }
  return "—";
}

function clinicOrLocation(clinics: CrmShellClinicOption[], row: FiBookingRow): string {
  if (row.clinic_id) {
    const c = clinics.find((x) => x.id === row.clinic_id);
    if (c) return c.display_name;
    return row.clinic_id.slice(0, 8);
  }
  return row.location?.trim() || "—";
}

function humanizeBookingType(type: string): string {
  const t = type.trim();
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatOsWhenSummary(startIso: string, endIso: string, tz: string): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const dateOpts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: tz,
    };
    const timeOpts: Intl.DateTimeFormatOptions = { timeStyle: "short", timeZone: tz };
    const dateStr = start.toLocaleString(undefined, dateOpts);
    const t1 = start.toLocaleString(undefined, timeOpts);
    const t2 = end.toLocaleString(undefined, timeOpts);
    return `${dateStr} · ${t1}–${t2}`;
  } catch {
    return `${startIso} → ${endIso}`;
  }
}

function anchorSummary(
  tenantId: string,
  row: FiBookingRow,
  variant: "default" | "fiOs"
): ReactNode {
  const link =
    variant === "fiOs"
      ? "text-cyan-300 hover:text-cyan-200 hover:underline"
      : "text-blue-300 hover:underline";
  const muted = variant === "fiOs" ? "text-slate-400" : "text-slate-300";
  const code =
    variant === "fiOs"
      ? "rounded bg-white/[0.06] px-0.5 text-xs text-slate-200"
      : "rounded bg-white/[0.06] px-0.5 text-xs";
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
      <Link
        key="patient"
        className={link}
        href={`/fi-admin/${tenantId}/patients/${row.patient_id}`}
      >
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
  if (parts.length === 0)
    return <span className={variant === "fiOs" ? "text-slate-500" : "text-gray-400"}>—</span>;
  return <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs">{parts}</span>;
}

function shortId(id: string): string {
  const t = id.trim();
  if (t.length <= 10) return t;
  return `${t.slice(0, 8)}…`;
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
  staffDirectory,
  canMutateBookings = true,
  procedureLabel,
  patientContactEmail,
  patientContactPhone,
  clinicalStaffing,
  onBookingUpdated,
  calendarOsSourceLabel,
  googleMeetUrl,
  calendarOsCalendarId,
  calendarOsEventTypeLabel,
  calendarOsExternalEventId,
  calendarOsStatus,
  operationalIntelligence,
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
  /** Prefer staff directory for FI OS provider labels (falls back to assignees). */
  staffDirectory?: CrmShellUserPickerOption[];
  /** When false, hide destructive / schedule mutations (FI OS calendar). */
  canMutateBookings?: boolean;
  /** Procedure display name from services catalog (FI OS). */
  procedureLabel?: string | null;
  patientContactEmail?: string | null;
  patientContactPhone?: string | null;
  clinicalStaffing?: ClinicalStaffingSummaryDto | null;
  onBookingUpdated?: (b: FiBookingRow) => void;
  calendarOsSourceLabel?: string | null;
  googleMeetUrl?: string | null;
  calendarOsCalendarId?: string | null;
  calendarOsEventTypeLabel?: string | null;
  calendarOsExternalEventId?: string | null;
  calendarOsStatus?: string | null;
  /** CalendarOS v2 — readiness, journey, blockers, next action. */
  operationalIntelligence?: CalendarBookingIntelligence | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const os = variant === "fiOs";

  useEffect(() => {
    if (!os || !booking) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [os, booking, onClose]);

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  if (!booking) return null;

  const row = booking;
  const calendarOsEvent = isCalendarOsEventRow(row);

  const cancelled = isBookingCancelled(row);
  const completed = row.booking_status === "completed";

  const tz = normalizeCalendarTimezone(calendarTimezone ?? row.timezone);
  const range = `${new Date(row.start_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  })} → ${new Date(row.end_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: tz })}`;
  const whenOneLine = formatOsWhenSummary(row.start_at, row.end_at, tz);

  const staffOptions = staffDirectory?.length ? staffDirectory : assignees;
  const assignment = bookingAssignmentDisplay(staffOptions, assignees, row);
  const providerLabel = assignment.summaryLine;
  const clinicLabel = clinicName(clinics, row);
  const roomLabel = row.location?.trim() || "—";
  const typeLabel =
    calendarOsEventTypeLabel?.trim() ||
    procedureLabel?.trim() ||
    humanizeBookingType(row.booking_type);
  const headerName = patientSummary?.trim() || row.title?.trim() || typeLabel;
  const locationLabel = row.location?.trim() || "—";
  const sourceLabel = calendarOsSourceLabel?.trim() || "—";
  const eventStatusLabel = calendarOsStatus?.trim() || row.booking_status;

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

  async function onMarkArrived() {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await updateBookingAction(
        tenantId,
        row.id,
        withAdmin({ bookingStatus: "arrived" })
      );
      if (!r.ok) setFeedback(r.error);
      else {
        onBookingUpdated?.(r.booking);
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onStartConsultation() {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await createConsultationFromBookingAction(tenantId, row.id, withAdmin({}));
      if (!r.ok) {
        setFeedback(r.error);
        return;
      }
      onClose();
      router.push(
        `/fi-admin/${tenantId.trim()}/consultations/${encodeURIComponent(r.consultationId)}`
      );
    } finally {
      setBusy(false);
    }
  }

  const mut = canMutateBookings;
  const canMarkArrived =
    mut &&
    !cancelled &&
    !completed &&
    (row.booking_status === "scheduled" || row.booking_status === "confirmed");
  const canRescheduleOrComplete = mut && !cancelled && !completed;

  const osActionClass =
    "inline-flex w-full items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.05] px-2 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/[0.09] disabled:pointer-events-none disabled:opacity-40";
  const osActionMuted =
    "inline-flex w-full items-center justify-center rounded-md border border-white/[0.08] px-2 py-2 text-xs text-slate-400";
  const osActionGood =
    "inline-flex w-full items-center justify-center rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/18 disabled:pointer-events-none disabled:opacity-40";
  const osActionDanger =
    "inline-flex w-full items-center justify-center rounded-md border border-red-400/25 bg-red-950/35 px-2 py-2 text-xs font-medium text-red-100 transition hover:bg-red-950/55 disabled:pointer-events-none disabled:opacity-40";

  return (
    <div
      className={
        os
          ? "fixed inset-0 z-[190] flex justify-end bg-black/55 backdrop-blur-[3px]"
          : "fixed inset-0 z-40 flex justify-end bg-black/30"
      }
      role="presentation"
      onClick={onClose}
    >
      <aside
        className={
          os
            ? "flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-white/[0.08] bg-[#070f1a]/96 text-slate-100 shadow-2xl shadow-black/60 backdrop-blur-xl"
            : "h-full w-full max-w-md overflow-y-auto bg-[#0F1629]/80 backdrop-blur-md shadow-xl"
        }
        role="dialog"
        aria-label="Booking details"
        onClick={(e) => e.stopPropagation()}
      >
        {os ? (
          <>
            <header className="shrink-0 border-b border-white/[0.08] px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate text-[15px] font-semibold leading-tight text-slate-50">
                    {headerName}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {typeLabel}
                    </span>
                    <BookingStatusBadge status={row.booking_status} />
                  </div>
                  <p className="text-xs leading-snug text-slate-400">{whenOneLine}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {calendarOsEvent ? (
                <p className="mb-3 rounded-md border border-cyan-500/20 bg-cyan-950/30 px-2.5 py-2 text-[11px] leading-snug text-cyan-100/90">
                  CalendarOS event — read-only in this phase. Edit in Google Calendar or the
                  CalendarOS test panel.
                </p>
              ) : null}

              {!calendarOsEvent ? (
                <div className="grid grid-cols-2 gap-2">
                  {row.patient_id ? (
                    <Link
                      href={`/fi-admin/${tenantId}/patients/${row.patient_id}`}
                      className={osActionClass}
                    >
                      Open patient
                    </Link>
                  ) : (
                    <span className={osActionMuted} title="No linked patient">
                      Open patient
                    </span>
                  )}
                  <button
                    type="button"
                    className={osActionClass}
                    disabled={busy || !mut}
                    title={!mut ? "No booking edit permission" : undefined}
                    onClick={() => void onStartConsultation()}
                  >
                    Start consultation
                  </button>
                  <Link
                    href={`/fi-admin/${tenantId}/foundation-integrity`}
                    className={osActionClass}
                  >
                    Patient twin
                  </Link>
                  {row.case_id ? (
                    <Link
                      href={`/fi-admin/${tenantId}/cases/${row.case_id}`}
                      className={osActionClass}
                    >
                      Open case
                    </Link>
                  ) : (
                    <span className={osActionMuted} title="No linked case">
                      Open case
                    </span>
                  )}
                  <button
                    type="button"
                    className={osActionClass}
                    disabled={busy || !canRescheduleOrComplete}
                    title={!mut ? "No booking edit permission" : undefined}
                    onClick={() => {
                      onEdit(row);
                      onClose();
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    className={osActionClass}
                    disabled={busy || !canMarkArrived}
                    title={
                      !canMarkArrived && mut && !cancelled && !completed
                        ? "Only from scheduled or confirmed"
                        : undefined
                    }
                    onClick={() => void onMarkArrived()}
                  >
                    Mark arrived
                  </button>
                  <button
                    type="button"
                    className={osActionGood}
                    disabled={busy || !canRescheduleOrComplete}
                    onClick={() => void onComplete()}
                  >
                    Mark completed
                  </button>
                  <button
                    type="button"
                    className={osActionDanger}
                    disabled={busy || !canRescheduleOrComplete}
                    onClick={() => void onCancel()}
                  >
                    Cancel booking
                  </button>
                </div>
              ) : null}

              <dl className="mt-4 space-y-2.5 border-t border-white/[0.06] pt-3 text-xs">
                {calendarOsEvent ? (
                  <>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">Source</dt>
                      <dd className="min-w-0 text-slate-200">{sourceLabel}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">Event type</dt>
                      <dd className="min-w-0 text-slate-200">{typeLabel}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">Location</dt>
                      <dd className="min-w-0 text-slate-200">{locationLabel}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">Status</dt>
                      <dd className="min-w-0 text-slate-200">{eventStatusLabel}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">Calendar id</dt>
                      <dd className="min-w-0 break-all font-mono text-[11px] text-slate-300">
                        {calendarOsCalendarId?.trim() || "—"}
                      </dd>
                    </div>
                    {googleMeetUrl?.trim() ? (
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-slate-500">Google Meet</dt>
                        <dd className="min-w-0 break-all">
                          <a
                            href={googleMeetUrl.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 hover:underline"
                          >
                            Join meeting
                          </a>
                        </dd>
                      </div>
                    ) : null}
                    {calendarOsExternalEventId?.trim() ? (
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-slate-500">External id</dt>
                        <dd
                          className="min-w-0 break-all font-mono text-[10px] text-slate-500"
                          title="Diagnostic only"
                        >
                          {shortId(calendarOsExternalEventId.trim())}
                        </dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-slate-500">Clinic</dt>
                  <dd className="min-w-0 text-slate-200">{calendarOsEvent ? "—" : clinicLabel}</dd>
                </div>
                {!calendarOsEvent ? (
                  <>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">Provider</dt>
                      <dd className="min-w-0 text-slate-200">{providerLabel}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">Room</dt>
                      <dd className="min-w-0 text-slate-200">{roomLabel}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">Phone</dt>
                      <dd className="min-w-0 break-all text-slate-200">
                        {patientContactPhone?.trim() || "—"}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">Email</dt>
                      <dd className="min-w-0 break-all text-slate-200">
                        {patientContactEmail?.trim() || "—"}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-slate-500">Notes</dt>
                      <dd className="min-w-0 whitespace-pre-wrap text-slate-300">
                        {row.description?.trim() || "—"}
                      </dd>
                    </div>
                  </>
                ) : null}
                {row.patient_id ? (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-slate-500">Patient id</dt>
                    <dd className="min-w-0 font-mono text-[11px] text-slate-300">
                      <Link
                        className="text-cyan-300 hover:underline"
                        href={`/fi-admin/${tenantId}/patients/${row.patient_id}`}
                      >
                        {shortId(row.patient_id)}
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {row.lead_id ? (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-slate-500">Lead</dt>
                    <dd className="min-w-0 font-mono text-[11px] text-slate-300">
                      <Link
                        className="text-cyan-300 hover:underline"
                        href={`/fi-admin/${tenantId}/crm/leads/${row.lead_id}`}
                      >
                        {shortId(row.lead_id)}
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {row.person_id ? (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-slate-500">Person</dt>
                    <dd className="min-w-0 font-mono text-[11px] text-slate-300">
                      {shortId(row.person_id)}
                    </dd>
                  </div>
                ) : null}
                {row.case_id ? (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-slate-500">Case</dt>
                    <dd className="min-w-0 font-mono text-[11px] text-slate-300">
                      <Link
                        className="text-cyan-300 hover:underline"
                        href={`/fi-admin/${tenantId}/cases/${row.case_id}`}
                      >
                        {shortId(row.case_id)}
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
              {operationalIntelligence && !calendarOsEvent ? (
                <div className="mt-4 space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Operational readiness
                  </p>
                  {operationalIntelligence.journeyStateLabel ? (
                    <p className="text-slate-300">
                      Journey:{" "}
                      <span className="font-medium text-slate-100">
                        {operationalIntelligence.journeyStateLabel}
                      </span>
                    </p>
                  ) : null}
                  {operationalIntelligence.readinessPercent != null ? (
                    <p className="text-slate-300">
                      Readiness:{" "}
                      <span className="font-medium tabular-nums text-slate-100">
                        {operationalIntelligence.readinessPercent}%
                      </span>
                    </p>
                  ) : null}
                  <p className="text-slate-300">
                    Payment:{" "}
                    <span className="font-medium capitalize text-slate-100">
                      {operationalIntelligence.paymentFlag.replace(/_/g, " ")}
                    </span>
                    {" · "}
                    Consent:{" "}
                    <span className="font-medium capitalize text-slate-100">
                      {operationalIntelligence.consentFlag}
                    </span>
                  </p>
                  {operationalIntelligence.blockers.length ? (
                    <ul className="space-y-1">
                      {operationalIntelligence.blockers.map((b) => (
                        <li key={b.kind} className="flex items-start gap-2 text-slate-300">
                          <span
                            className={
                              b.severity === "critical" ? "text-rose-300" : "text-amber-300"
                            }
                          >
                            •
                          </span>
                          {b.href ? (
                            <Link href={b.href} className="hover:text-cyan-300 hover:underline">
                              {b.label}
                            </Link>
                          ) : (
                            <span>{b.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-emerald-300/90">No operational blockers detected.</p>
                  )}
                  {operationalIntelligence.nextAction ? (
                    <p className="border-t border-white/[0.06] pt-2 text-slate-400">
                      Next:{" "}
                      {operationalIntelligence.nextAction.href ? (
                        <Link
                          href={operationalIntelligence.nextAction.href}
                          className="font-medium text-cyan-300 hover:underline"
                        >
                          {operationalIntelligence.nextAction.label}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-200">
                          {operationalIntelligence.nextAction.label}
                        </span>
                      )}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {clinicalStaffing && !calendarOsEvent ? (
                <div className="mt-4">
                  <ClinicalStaffingStatusCard
                    tenantId={tenantId}
                    summary={clinicalStaffing}
                    compact
                    rosterLink={
                      booking
                        ? {
                            eventSource: "booking",
                            eventId: booking.id,
                            date: booking.start_at,
                          }
                        : undefined
                    }
                  />
                </div>
              ) : null}

              {cancelled ? (
                <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-950/40 p-2.5 text-[11px] text-amber-100">
                  <p className="font-medium">Cancelled</p>
                  {row.cancellation_reason?.trim() ? (
                    <p className="mt-1 text-amber-100/90">Reason: {row.cancellation_reason}</p>
                  ) : null}
                </div>
              ) : null}
              {completed ? (
                <p className="mt-3 text-[11px] text-slate-500">Completed — read-only.</p>
              ) : null}
              {feedback ? <p className="mt-3 text-xs text-red-300">{feedback}</p> : null}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-100">
                {row.title?.trim() || "Booking"}
              </h2>
              <button
                type="button"
                className="text-sm text-slate-400 hover:text-slate-100"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            <div className="space-y-4 p-4 text-sm text-slate-200">
              {calendarOsEvent ? (
                <>
                  <p className="rounded border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
                    CalendarOS event — read-only display. No edits from the calendar UI in this
                    phase.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <BookingTypeBadge type={row.booking_type} />
                    <BookingStatusBadge status={row.booking_status} />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Title</p>
                    <p className="mt-1 text-base font-medium text-slate-100">{headerName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">When</p>
                    <p className="mt-1">{range}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Event type</p>
                    <p className="mt-1">{typeLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Location</p>
                    <p className="mt-1">{locationLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Source</p>
                    <p className="mt-1">{sourceLabel}</p>
                  </div>
                  {googleMeetUrl?.trim() ? (
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-500">Google Meet</p>
                      <p className="mt-1">
                        <a
                          href={googleMeetUrl.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-300 hover:underline"
                        >
                          Join meeting
                        </a>
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Linked</p>
                    <div className="mt-1">{anchorSummary(tenantId, row, variant)}</div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Calendar id</p>
                    <p className="mt-1 font-mono text-xs text-slate-300">
                      {calendarOsCalendarId?.trim() || "—"}
                    </p>
                  </div>
                  {calendarOsExternalEventId?.trim() ? (
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-500">External id</p>
                      <p
                        className="mt-1 font-mono text-[11px] text-gray-500"
                        title="Diagnostic only"
                      >
                        {shortId(calendarOsExternalEventId.trim())}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <BookingTypeBadge type={row.booking_type} />
                    <BookingStatusBadge status={row.booking_status} />
                  </div>

                  {patientSummary?.trim() ? (
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-500">
                        Patient / anchor
                      </p>
                      <p className="mt-1 text-base font-medium text-slate-100">
                        {patientSummary.trim()}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">When</p>
                    <p className="mt-1">{range}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Linked</p>
                    <div className="mt-1">{anchorSummary(tenantId, row, variant)}</div>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Provider</p>
                    <p className="mt-1">{assignment.summaryLine}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Location / clinic</p>
                    <p className="mt-1">{clinicOrLocation(clinics, row)}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-300">
                      {row.description?.trim() || "—"}
                    </p>
                  </div>

                  {cancelled ? (
                    <div className="rounded border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-200">
                      <p className="font-medium">Cancelled</p>
                      {row.cancellation_reason?.trim() ? (
                        <p className="mt-2">Reason: {row.cancellation_reason}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                    {!cancelled && !completed ? (
                      <>
                        <button
                          type="button"
                          className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/[0.03] disabled:opacity-50"
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
                          className="rounded border border-emerald-600 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void onComplete()}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className="rounded border border-red-300 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
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
                  {feedback ? <p className="text-sm text-rose-300">{feedback}</p> : null}
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
