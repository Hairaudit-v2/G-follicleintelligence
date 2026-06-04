import Link from "next/link";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 18;
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;

type PlaceholderEvent = {
  id: string;
  title: string;
  startMin: number;
  durationMin: number;
  tone: "sky" | "violet" | "amber" | "emerald";
};

const PLACEHOLDER_EVENTS: PlaceholderEvent[] = [
  { id: "1", title: "Consultation", startMin: 9 * 60 - DAY_START_HOUR * 60, durationMin: 60, tone: "sky" },
  { id: "2", title: "PRP / Treatment", startMin: 11 * 60 - DAY_START_HOUR * 60, durationMin: 90, tone: "violet" },
  { id: "3", title: "Surgery planning", startMin: 13 * 60 - DAY_START_HOUR * 60, durationMin: 60, tone: "amber" },
  { id: "4", title: "Follow-up", startMin: 15 * 60 + 30 - DAY_START_HOUR * 60, durationMin: 30, tone: "emerald" },
];

const HOUR_ROWS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

function formatHourLabel(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

const toneClasses: Record<PlaceholderEvent["tone"], string> = {
  sky: "border-sky-200 bg-sky-50 text-sky-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

function SidebarAction({
  href,
  label,
  description,
  enabled,
  disabledReason,
}: {
  href: string;
  label: string;
  description: string;
  enabled: boolean;
  disabledReason?: string;
}) {
  const cardClass =
    "flex flex-col rounded-lg border px-3 py-2.5 text-left text-sm transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/35";

  if (!enabled) {
    return (
      <div
        className={cn(cardClass, "cursor-not-allowed border-dashed border-slate-200 bg-slate-50/90 text-slate-500")}
        aria-disabled="true"
        title={disabledReason}
      >
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="mt-0.5 text-xs text-slate-500">{description}</span>
        <span className="mt-2 text-[11px] font-medium text-slate-500">{disabledReason ?? "Unavailable"}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        cardClass,
        "border-slate-200 bg-white font-semibold text-slate-900 shadow-sm hover:border-sky-200/80 hover:bg-sky-50/50"
      )}
    >
      <span>{label}</span>
      <span className="mt-0.5 text-xs font-normal text-slate-600">{description}</span>
    </Link>
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
};

/**
 * Clinic OS calendar landing (Stage 1G): day-style shell with placeholder appointments only.
 * No live bookings, mutations, or calendar data wiring.
 */
export function ClinicOsCalendarHome({ tenantId, showCrmNav }: ClinicOsCalendarHomeProps) {
  const base = `/fi-admin/${tenantId.trim()}`;
  const dayColumnMinHeight = 528;

  return (
    <div className="space-y-4">
      <p id="clinic-os-calendar-preview-note" className="sr-only">
        Calendar grid and appointments are demonstration placeholders only. They are not live schedule data.
      </p>

      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-describedby="clinic-os-calendar-preview-note">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sky-700">
            <CalendarIcon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Calendar</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              View bookings, consultations, treatments and surgery-related appointments.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        <section
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
          aria-labelledby="clinic-os-day-calendar-heading"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h2 id="clinic-os-day-calendar-heading" className="text-sm font-semibold text-slate-900">
              Day view
            </h2>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Preview
            </span>
          </div>

          <div className="flex gap-0 overflow-x-auto">
            <div
              className="flex w-14 shrink-0 flex-col border-r border-slate-200 pr-2 text-right text-xs text-slate-500 sm:w-16"
              style={{ minHeight: dayColumnMinHeight }}
            >
              {HOUR_ROWS.map((h) => (
                <div
                  key={h}
                  className="flex h-12 shrink-0 items-start justify-end pt-0.5 font-medium tabular-nums text-slate-500"
                >
                  {formatHourLabel(h)}
                </div>
              ))}
            </div>

            <div className="relative min-w-[200px] flex-1" style={{ minHeight: dayColumnMinHeight }}>
              <div className="absolute inset-0 flex flex-col">
                {HOUR_ROWS.map((h) => (
                  <div key={h} className="h-12 shrink-0 border-b border-slate-100" />
                ))}
              </div>

              <div
                className="absolute left-0 right-2 top-0 sm:right-3"
                style={{ height: dayColumnMinHeight }}
                role="list"
                aria-label="Sample appointments for layout preview"
              >
                {PLACEHOLDER_EVENTS.map((ev) => {
                  const topPct = (ev.startMin / TOTAL_MINUTES) * 100;
                  const heightPct = (ev.durationMin / TOTAL_MINUTES) * 100;
                  return (
                    <div
                      key={ev.id}
                      role="listitem"
                      className={cn(
                        "absolute left-0 right-0 overflow-hidden rounded-md border px-2 py-1.5 shadow-sm",
                        toneClasses[ev.tone]
                      )}
                      style={{ top: `${topPct}%`, height: `${heightPct}%`, minHeight: "2.25rem" }}
                    >
                      <p className="text-xs font-semibold leading-tight">{ev.title}</p>
                      <p className="mt-0.5 text-[10px] font-medium opacity-80">Sample · not a live booking</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="w-full shrink-0 space-y-4 lg:w-72" aria-label="Calendar tools and filters">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
            <p className="mt-0.5 text-xs text-slate-500">Jump to common workflows</p>
            <div className="mt-3 space-y-2">
              <SidebarAction
                href={`${base}/bookings/new`}
                label="New booking"
                description="Start a booking for this clinic"
                enabled={showCrmNav}
                disabledReason="Booking workspace requires CRM access (fi_admin or crm_operator)."
              />
              <SidebarAction
                href={`${base}/patients/new`}
                label="Add patient"
                description="Create a patient record"
                enabled
              />
              <SidebarAction
                href={`${base}/crm`}
                label="Open CRM leads"
                description="Pipeline and lead inbox"
                enabled={showCrmNav}
                disabledReason="CRM is available when your account has CRM workspace access."
              />
              <SidebarAction href={`${base}/cases`} label="Open cases" description="Clinical cases and worklists" enabled />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Staff view</h2>
            <p className="mt-0.5 text-xs text-slate-500">Filter by role (preview)</p>
            <div className="mt-3 space-y-1.5">
              <PlaceholderChip label="All staff" />
              <PlaceholderChip label="Doctor" />
              <PlaceholderChip label="Nurse" />
              <PlaceholderChip label="Consultant" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Rooms & resources</h2>
            <p className="mt-0.5 text-xs text-slate-500">Location filters (preview)</p>
            <div className="mt-3 space-y-1.5">
              <PlaceholderChip label="Consultation room" />
              <PlaceholderChip label="Treatment room" />
              <PlaceholderChip label="Surgery room" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
