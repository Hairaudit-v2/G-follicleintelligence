import Link from "next/link";
import { Calendar, Users } from "lucide-react";

import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type {
  AgendaBucket,
  DashboardBookingItem,
  ReceptionBoardCard,
  TenantOperationalDay,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { FI_DASHBOARD_WIDGET_LABELS } from "@/src/config/fiDashboardRegistry";

const BUCKET_LABEL: Record<AgendaBucket, string> = {
  consult: "Consultation",
  surgery: "Surgery",
  follow_up: "Follow-up",
  other: "Appointment",
};

function formatSlot(iso: string, tz: string | null): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz?.trim() || undefined,
  }).format(d);
}

function bookingDetailHref(tenantId: string, row: DashboardBookingItem): string {
  const base = `/fi-admin/${tenantId}`;
  if (row.case_id) return `${base}/cases/${row.case_id}`;
  if (row.patient_id) return `${base}/patients/${row.patient_id}`;
  if (row.lead_id) return `${base}/crm/leads/${row.lead_id}`;
  return `${base}/calendar`;
}

function isInOperationalDay(iso: string, localStartIso: string, localEndIso: string): boolean {
  const t = Date.parse(iso);
  const a = Date.parse(localStartIso);
  const b = Date.parse(localEndIso);
  if (![t, a, b].every(Number.isFinite)) return iso >= localStartIso && iso < localEndIso;
  return t >= a && t < b;
}

function todayAppointmentsForOperationalDay(
  agendaByBucket: Record<AgendaBucket, DashboardBookingItem[]>,
  operationalDay: TenantOperationalDay
): { bucket: AgendaBucket; row: DashboardBookingItem }[] {
  const { localStartIso, localEndIso } = operationalDay;
  const flat = (["consult", "surgery", "follow_up", "other"] as AgendaBucket[])
    .flatMap((bucket) => agendaByBucket[bucket].map((row) => ({ bucket, row })))
    .filter(({ row }) => isInOperationalDay(row.start_at, localStartIso, localEndIso))
    .sort((a, b) => a.row.start_at.localeCompare(b.row.start_at));
  return flat;
}

type StaffShiftRow = {
  key: string;
  providerLabel: string;
  roleLabel: string;
  earliestStartIso: string;
  timezone: string | null;
};

function staffRowsFromReceptionCards(cards: readonly ReceptionBoardCard[]): StaffShiftRow[] {
  /** Case-insensitive key so the same clinician is not listed twice when labels differ only by casing. */
  const byCanonical = new Map<
    string,
    { displayLabel: string; earliest: string; tz: string | null }
  >();
  for (const c of cards) {
    const label = c.providerLabel.trim();
    if (!label || label.toLowerCase() === "unassigned") continue;
    const canon = label.toLowerCase();
    const prev = byCanonical.get(canon);
    if (!prev) {
      byCanonical.set(canon, { displayLabel: label, earliest: c.startAt, tz: c.timezone });
    } else if (c.startAt < prev.earliest) {
      byCanonical.set(canon, { ...prev, earliest: c.startAt, tz: c.timezone });
    }
  }
  return [...byCanonical.entries()]
    .map(([canon, { displayLabel, earliest, tz }]) => ({
      key: canon,
      providerLabel: displayLabel,
      roleLabel: "Provider",
      earliestStartIso: earliest,
      timezone: tz,
    }))
    .sort((a, b) => a.earliestStartIso.localeCompare(b.earliestStartIso));
}

const panelShell =
  "flex min-h-[11rem] flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 sm:min-h-[12rem] sm:p-4";

export function DashboardOperationalWorkspace(props: {
  tenantId: string;
  base: string;
  operationalDay: TenantOperationalDay;
  agendaByBucket: Record<AgendaBucket, DashboardBookingItem[]>;
  receptionCards: readonly ReceptionBoardCard[];
}) {
  const { tenantId, base, operationalDay, agendaByBucket, receptionCards } = props;
  const meta = FI_DASHBOARD_WIDGET_LABELS.operational_workspace;
  const appts = todayAppointmentsForOperationalDay(agendaByBucket, operationalDay);
  const staffRows = staffRowsFromReceptionCards(receptionCards);

  return (
    <DashboardCard
      className="p-4 sm:p-5"
      role="region"
      aria-labelledby="dash-operational-workspace-heading"
    >
      <SectionHeader
        id="dash-operational-workspace-heading"
        kicker="Operations"
        title={meta.title}
        description={meta.description}
      />
      <div className="mt-4 grid min-h-[10rem] grid-cols-1 gap-3 md:min-h-[11rem] md:grid-cols-2 md:gap-4">
        <div className={panelShell}>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Today’s appointments
          </p>
          {appts.length === 0 ? (
            <div className="mt-3 flex flex-1 flex-col justify-center rounded-lg border border-dashed border-white/[0.08] bg-black/15 px-3 py-4 text-center">
              <Calendar className="mx-auto h-5 w-5 text-slate-600" aria-hidden />
              <p className="mt-2 text-sm font-medium text-slate-300">
                No visits in this clinic day window
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Book from the calendar or reception board to populate the day.
              </p>
              <Link
                href={`${base}/calendar`}
                className="mx-auto mt-3 text-xs font-semibold text-cyan-400/90 underline-offset-2 hover:underline"
              >
                Open calendar
              </Link>
            </div>
          ) : (
            <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
              {appts.map(({ bucket, row }) => (
                <li key={row.id}>
                  <Link
                    href={bookingDetailHref(tenantId, row)}
                    className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 text-left transition hover:border-cyan-500/25 hover:bg-cyan-500/[0.04]"
                  >
                    <span className="w-14 shrink-0 font-mono text-xs font-semibold tabular-nums text-cyan-200/90">
                      {formatSlot(row.start_at, row.timezone)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-100">
                        {row.title?.trim() || "Booking"}
                      </span>
                      <span className="mt-0.5 block text-[0.7rem] text-slate-500">
                        {BUCKET_LABEL[bucket]} · {bookingTypeLabel(row.booking_type)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={panelShell}>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Staff on shift today
          </p>
          {staffRows.length === 0 ? (
            <div className="mt-3 flex flex-1 flex-col justify-center rounded-lg border border-dashed border-white/[0.08] bg-black/15 px-3 py-4 text-center">
              <Users className="mx-auto h-5 w-5 text-slate-600" aria-hidden />
              <p className="mt-2 text-sm font-medium text-slate-300">
                No assigned providers on today’s board
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Assign clinical staff on bookings to see coverage here. Role labels follow when HR
                exposes them.
              </p>
              <Link
                href={`${base}/reception`}
                className="mx-auto mt-3 text-xs font-semibold text-cyan-400/90 underline-offset-2 hover:underline"
              >
                Open reception
              </Link>
            </div>
          ) : (
            <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
              {staffRows.map((s) => (
                <li
                  key={s.key}
                  className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {s.providerLabel}
                    </span>
                    <span className="mt-0.5 block text-[0.7rem] text-slate-500">{s.roleLabel}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-cyan-200/90">
                    {formatSlot(s.earliestStartIso, s.timezone)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
