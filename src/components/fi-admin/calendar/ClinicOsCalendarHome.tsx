import { Calendar as CalendarIcon } from "lucide-react";
import Link from "next/link";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";
import { FiSection } from "@/src/components/fi-design/FiSection";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import type { ClinicOsCalendarLiveBookingDTO, ClinicOsCalendarReadOnlyPayload } from "@/src/lib/fiAdmin/clinicOsCalendarTypes";
import { cn } from "@/lib/utils";

/** Calendar body starts at 8:00; last slot ends at 6:00pm (18:00). Preview uses local wall clock; live uses UTC (see Stage 2A). */
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;
const HOUR_COUNT = DAY_END_HOUR - DAY_START_HOUR;
const TOTAL_MINUTES = HOUR_COUNT * 60;
const HOUR_ROW_PX = 44;
const GRID_BODY_PX = HOUR_COUNT * HOUR_ROW_PX;

const RESOURCE_COLUMNS = [
  { id: "doctor", label: "Doctor" },
  { id: "consultant", label: "Consultant" },
  { id: "nursePrp", label: "Nurse PRP" },
  { id: "surgeryRoom", label: "Surgery Room" },
] as const;

type ColumnId = (typeof RESOURCE_COLUMNS)[number]["id"];

type PreviewTone = "consult" | "treatment" | "surgery" | "followup" | "planning";

const toneClass: Record<PreviewTone, string> = {
  consult: "border-sky-200 bg-sky-50/95 text-sky-950 ring-1 ring-sky-100",
  treatment: "border-violet-200 bg-violet-50/95 text-violet-950 ring-1 ring-violet-100",
  surgery: "border-amber-200 bg-amber-50/95 text-amber-950 ring-1 ring-amber-100",
  followup: "border-emerald-200 bg-emerald-50/95 text-emerald-950 ring-1 ring-emerald-100",
  planning: "border-indigo-200 bg-indigo-50/95 text-indigo-950 ring-1 ring-indigo-100",
};

const liveToneClass =
  "border-slate-300 bg-white text-slate-950 ring-1 ring-slate-200 shadow-sm hover:border-slate-400/90";

type PlaceholderAppointment = {
  id: string;
  title: string;
  patientName: string;
  /** Minutes from 8:00am local (0 = 8:00am). */
  startMin: number;
  durationMin: number;
  column: ColumnId;
  tone: PreviewTone;
};

const PLACEHOLDER_APPOINTMENTS: PlaceholderAppointment[] = [
  {
    id: "a1",
    title: "Consultation",
    patientName: "Sample · Jordan Lee",
    startMin: 30,
    durationMin: 30,
    column: "doctor",
    tone: "consult",
  },
  {
    id: "a2",
    title: "Follow-up",
    patientName: "Sample · Priya N.",
    startMin: 60,
    durationMin: 30,
    column: "nursePrp",
    tone: "followup",
  },
  {
    id: "a3",
    title: "PRP Treatment",
    patientName: "Sample · Marcus Chen",
    startMin: 120,
    durationMin: 60,
    column: "nursePrp",
    tone: "treatment",
  },
  {
    id: "a4",
    title: "Hair Transplant Planning",
    patientName: "Sample · Elena Rossi",
    startMin: 210,
    durationMin: 60,
    column: "consultant",
    tone: "planning",
  },
  {
    id: "a5",
    title: "Surgery Review",
    patientName: "Sample · David Okafor",
    startMin: 330,
    durationMin: 45,
    column: "surgeryRoom",
    tone: "surgery",
  },
  {
    id: "a6",
    title: "Follow-up",
    patientName: "Sample · Ana Müller",
    startMin: 450,
    durationMin: 30,
    column: "doctor",
    tone: "followup",
  },
];

const HOUR_ROWS = Array.from({ length: HOUR_COUNT }, (_, i) => DAY_START_HOUR + i);

function formatHourLabel(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** Hour labels aligned with UTC grid (live bookings). */
function formatHourLabelUtc(h: number): string {
  const d = new Date(Date.UTC(2000, 0, 1, h, 0, 0, 0));
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
}

function formatClockFromDayStartLocal(startMin: number): string {
  const total = DAY_START_HOUR * 60 + startMin;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

function formatTimeRangeLocal(startMin: number, durationMin: number): string {
  const endMin = startMin + durationMin;
  return `${formatClockFromDayStartLocal(startMin)} – ${formatClockFromDayStartLocal(endMin)}`;
}

function formatUtcTimeRange(isoStart: string, isoEnd: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  };
  return `${new Date(isoStart).toLocaleTimeString(undefined, opts)} – ${new Date(isoEnd).toLocaleTimeString(undefined, opts)} UTC`;
}

function PreviewAppointmentBlock({ appt }: { appt: PlaceholderAppointment }) {
  const topPct = (appt.startMin / TOTAL_MINUTES) * 100;
  const heightPct = (appt.durationMin / TOTAL_MINUTES) * 100;
  return (
    <div
      role="listitem"
      className={cn(
        "absolute left-0.5 right-0.5 overflow-hidden rounded-md border px-1.5 py-1 shadow-sm",
        toneClass[appt.tone]
      )}
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        minHeight: "2.75rem",
      }}
    >
      <p className="text-[11px] font-semibold leading-tight tracking-tight">{appt.title}</p>
      <p className="mt-0.5 truncate text-[10px] font-medium text-slate-700/95">{appt.patientName}</p>
      <p className="mt-0.5 text-[10px] tabular-nums text-slate-600">{formatTimeRangeLocal(appt.startMin, appt.durationMin)}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Preview only</p>
    </div>
  );
}

function LiveBookingBlock({ appt }: { appt: ClinicOsCalendarLiveBookingDTO }) {
  const topPct = (appt.startMin / TOTAL_MINUTES) * 100;
  const heightPct = (appt.durationMin / TOTAL_MINUTES) * 100;

  const inner = (
    <>
      <p className="text-[11px] font-semibold leading-tight tracking-tight">{appt.title}</p>
      <p className="mt-0.5 truncate text-[10px] font-medium text-slate-700/95">{appt.patientName}</p>
      <p className="mt-0.5 text-[10px] tabular-nums text-slate-600">{formatUtcTimeRange(appt.startTime, appt.endTime)}</p>
      <p className="mt-0.5 truncate text-[9px] text-slate-600">{appt.appointmentType}</p>
      {appt.staffName ? (
        <p className="mt-0.5 truncate text-[9px] text-slate-600">Staff: {appt.staffName}</p>
      ) : null}
      {appt.roomName ? (
        <p className="mt-0.5 truncate text-[9px] text-slate-600">Room: {appt.roomName}</p>
      ) : null}
      {appt.status ? (
        <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-600">Status: {appt.status}</p>
      ) : null}
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800/90">Read-only</p>
    </>
  );

  const className = cn(
    "absolute left-0.5 right-0.5 overflow-hidden rounded-md border px-1.5 py-1",
    liveToneClass,
    appt.href ? "transition-colors" : "cursor-default"
  );
  const style = {
    top: `${topPct}%`,
    height: `${heightPct}%`,
    minHeight: "2.75rem",
  };

  if (appt.href) {
    return (
      <Link href={appt.href} className={cn(className, "block text-left no-underline")} style={style} role="listitem">
        {inner}
      </Link>
    );
  }

  return (
    <div role="listitem" className={className} style={style}>
      {inner}
    </div>
  );
}

function PlaceholderChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-left text-xs font-medium text-slate-500 shadow-sm"
      title="Preview only — not connected to roster or rooms"
    >
      {label}
    </button>
  );
}

type ClinicOsCalendarHomeProps = {
  tenantId: string;
  /** From `getCrmShellNavAllowed` — gates booking and CRM shortcuts only. */
  showCrmNav: boolean;
  calendarReadOnly: ClinicOsCalendarReadOnlyPayload;
};

/**
 * Clinic OS calendar landing: Stage 1J layout; Stage 2A adds read-only live bookings for today (UTC)
 * when rows exist, otherwise preview placeholders only.
 */
export function ClinicOsCalendarHome({ tenantId, showCrmNav, calendarReadOnly }: ClinicOsCalendarHomeProps) {
  const base = `/fi-admin/${tenantId.trim()}`;
  const hasLive = calendarReadOnly.liveBookings.length > 0;
  const formatHour = hasLive ? formatHourLabelUtc : formatHourLabel;

  return (
    <div className="space-y-4">
      <p id="clinic-os-calendar-preview-note" className="sr-only">
        {hasLive
          ? "Live bookings are shown in read-only mode. Drag, drop, create, and reschedule are disabled."
          : "Calendar grid sample appointments are demonstration placeholders only. They are not live schedule data."}
      </p>

      <FiCard className="sm:p-5" aria-describedby="clinic-os-calendar-preview-note">
        <FiPageHeader
          title="Calendar"
          description="View bookings, consultations, treatments and surgery-related appointments."
          leading={
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sky-700">
              <CalendarIcon className="h-5 w-5" aria-hidden />
            </div>
          }
          className="lg:items-start"
        />
      </FiCard>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        <FiSection
          className="min-w-0 flex-1 p-3 sm:p-4"
          title="Day view"
          action={
            <FiStatusBadge tone={hasLive ? "success" : "neutral"}>{hasLive ? "Live (read-only)" : "Preview"}</FiStatusBadge>
          }
          headingId="clinic-os-day-calendar-heading"
          contentClassName="mt-0 border-t border-slate-100 pt-3"
        >
          <p
            className={cn(
              "mb-3 rounded-lg border px-3 py-2 text-sm leading-snug",
              hasLive ? "border-emerald-200/90 bg-emerald-50 text-emerald-950" : "border-sky-200/90 bg-sky-50 text-sky-950"
            )}
            role="status"
          >
            {hasLive
              ? "Showing live bookings in read-only mode."
              : "No live bookings found for today. Preview appointments are shown for layout only."}
          </p>

          {hasLive ? (
            <p className="mb-3 text-xs leading-snug text-slate-600">
              Day window matches FI booking calendar conventions: <span className="font-medium">UTC {calendarReadOnly.dayUtcYmd}</span>{" "}
              (8:00–18:00 UTC on the grid). Drag-and-drop and in-grid creation are disabled.
            </p>
          ) : null}

          {calendarReadOnly.listTruncated ? (
            <p className="mb-2 text-xs text-amber-800">
              Booking list may be truncated at the calendar safety cap; some overlapping rows might not appear.
            </p>
          ) : null}

          <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            <div className="inline-block min-w-[720px] w-max max-w-none align-top lg:min-w-[760px]">
              <div
                className="grid border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-700"
                style={{
                  gridTemplateColumns: `3.5rem repeat(${RESOURCE_COLUMNS.length}, minmax(6.5rem, 1fr))`,
                }}
              >
                <div className="border-r border-slate-200 px-1 py-2" aria-hidden />
                {RESOURCE_COLUMNS.map((col) => (
                  <div
                    key={col.id}
                    className="border-r border-slate-200 px-2 py-2 text-center last:border-r-0 sm:px-2.5"
                  >
                    {col.label}
                  </div>
                ))}
              </div>

              <div
                className="grid border-b border-slate-200 bg-white"
                style={{
                  gridTemplateColumns: `3.5rem repeat(${RESOURCE_COLUMNS.length}, minmax(6.5rem, 1fr))`,
                  minHeight: GRID_BODY_PX,
                }}
                role="list"
                aria-label={hasLive ? "Read-only multi-column schedule for today" : "Sample multi-column schedule for layout preview"}
              >
                <div className="relative border-r border-slate-200">
                  {HOUR_ROWS.map((h) => (
                    <div
                      key={h}
                      className="border-b border-slate-100 pr-1.5 pt-0.5 text-right text-[11px] font-medium tabular-nums text-slate-500 last:border-b-0"
                      style={{ height: HOUR_ROW_PX }}
                    >
                      {formatHour(h)}
                    </div>
                  ))}
                </div>

                {RESOURCE_COLUMNS.map((col) => (
                  <div
                    key={col.id}
                    className="relative border-r border-slate-100 bg-slate-50/20 last:border-r-0"
                    style={{ minHeight: GRID_BODY_PX }}
                  >
                    <div className="pointer-events-none absolute inset-0 flex flex-col">
                      {HOUR_ROWS.map((h) => (
                        <div key={h} className="shrink-0 border-b border-slate-100/90" style={{ height: HOUR_ROW_PX }} />
                      ))}
                    </div>
                    <div className="relative z-[1]" style={{ height: GRID_BODY_PX }}>
                      {hasLive
                        ? calendarReadOnly.liveBookings
                            .filter((a) => a.column === col.id)
                            .map((appt) => <LiveBookingBlock key={appt.id} appt={appt} />)
                        : PLACEHOLDER_APPOINTMENTS.filter((a) => a.column === col.id).map((appt) => (
                            <PreviewAppointmentBlock key={appt.id} appt={appt} />
                          ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FiSection>

        <aside className="w-full shrink-0 space-y-4 lg:w-72" aria-label="Calendar tools and filters">
          <FiSection title="Quick actions" description="Jump to common workflows">
            <div className="space-y-2">
              <FiQuickActionCard
                className="min-h-0 py-3 sm:min-h-0"
                title="New booking"
                description="Start a booking for this clinic"
                href={`${base}/bookings/new`}
                disabled={!showCrmNav}
                disabledReason="Booking workspace requires CRM access (fi_admin or crm_operator)."
                showOpenAffordance={false}
              />
              <FiQuickActionCard
                className="min-h-0 py-3 sm:min-h-0"
                title="Add patient"
                description="Create a patient record"
                href={`${base}/patients/new`}
                showOpenAffordance={false}
              />
              <FiQuickActionCard
                className="min-h-0 py-3 sm:min-h-0"
                title="Open CRM leads"
                description="Pipeline and lead inbox"
                href={`${base}/crm`}
                disabled={!showCrmNav}
                disabledReason="CRM is available when your account has CRM workspace access."
                showOpenAffordance={false}
              />
              <FiQuickActionCard
                className="min-h-0 py-3 sm:min-h-0"
                title="Open cases"
                description="Clinical cases and worklists"
                href={`${base}/cases`}
                showOpenAffordance={false}
              />
            </div>
          </FiSection>

          <FiSection title="Staff view" description="Filter by role (preview)">
            <div className="space-y-1.5">
              <PlaceholderChip label="All staff" />
              <PlaceholderChip label="Doctor" />
              <PlaceholderChip label="Consultant" />
              <PlaceholderChip label="Nurse PRP" />
            </div>
          </FiSection>

          <FiSection title="Rooms & resources" description="Location filters (preview)">
            <div className="space-y-1.5">
              <PlaceholderChip label="Consultation room" />
              <PlaceholderChip label="Treatment room" />
              <PlaceholderChip label="Surgery room" />
            </div>
          </FiSection>
        </aside>
      </div>
    </div>
  );
}
