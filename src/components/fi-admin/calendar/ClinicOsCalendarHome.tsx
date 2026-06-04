import { Calendar as CalendarIcon } from "lucide-react";

import { FiCalendarBlock } from "@/src/components/fi-design/FiCalendarBlock";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";
import { FiSection } from "@/src/components/fi-design/FiSection";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 18;
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;

type PlaceholderEvent = {
  id: string;
  title: string;
  startMin: number;
  durationMin: number;
  tone: "consult" | "treatment" | "surgery" | "followup";
};

const PLACEHOLDER_EVENTS: PlaceholderEvent[] = [
  { id: "1", title: "Consultation", startMin: 9 * 60 - DAY_START_HOUR * 60, durationMin: 60, tone: "consult" },
  { id: "2", title: "PRP / Treatment", startMin: 11 * 60 - DAY_START_HOUR * 60, durationMin: 90, tone: "treatment" },
  { id: "3", title: "Surgery planning", startMin: 13 * 60 - DAY_START_HOUR * 60, durationMin: 60, tone: "surgery" },
  { id: "4", title: "Follow-up", startMin: 15 * 60 + 30 - DAY_START_HOUR * 60, durationMin: 30, tone: "followup" },
];

const HOUR_ROWS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

function formatHourLabel(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
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
          action={<FiStatusBadge tone="neutral">Preview</FiStatusBadge>}
          headingId="clinic-os-day-calendar-heading"
          contentClassName="mt-0 border-t border-slate-100 pt-3"
        >
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
                    <FiCalendarBlock
                      key={ev.id}
                      title={ev.title}
                      tone={ev.tone}
                      placeholder
                      style={{ top: `${topPct}%`, height: `${heightPct}%`, minHeight: "2.25rem" }}
                    />
                  );
                })}
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
              <PlaceholderChip label="Nurse" />
              <PlaceholderChip label="Consultant" />
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
