import Link from "next/link";

import type { AgendaBucket, DashboardBookingItem } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";

const BUCKET_LABEL: Record<AgendaBucket, string> = {
  consult: "Consultations",
  surgery: "Hair Transplant",
  follow_up: "Follow-up & review",
  other: "Other appointments",
};

function formatRangeLabel(startIso: string, endIso: string): string {
  const a = new Date(startIso);
  const b = new Date(endIso);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return "";
  const df = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${df.format(a)} – ${df.format(b)}`;
}

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

export function DashboardTodayAgenda(props: {
  tenantId: string;
  agendaRange: { startIso: string; endIso: string };
  agendaByBucket: Record<AgendaBucket, DashboardBookingItem[]>;
}) {
  const { tenantId, agendaRange, agendaByBucket } = props;
  const total =
    agendaByBucket.consult.length +
    agendaByBucket.surgery.length +
    agendaByBucket.follow_up.length +
    agendaByBucket.other.length;

  const order: AgendaBucket[] = ["consult", "surgery", "follow_up", "other"];

  return (
    <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="dash-agenda-heading">
      <SectionHeader
        id="dash-agenda-heading"
        kicker="Schedule"
        title="Today's agenda"
        description={`Upcoming visits from midnight UTC today through the next 72 hours (${formatRangeLabel(agendaRange.startIso, agendaRange.endIso)}). Cancelled and completed bookings are hidden.`}
        className="mb-4"
      />
      {total === 0 ? (
        <p className="text-sm leading-relaxed text-[#94A3B8]">
          No upcoming bookings in this window.{" "}
          <Link href={`/fi-admin/${tenantId}/bookings/new`} className="font-medium text-[#22C1FF] underline-offset-2 hover:underline">
            Create a booking
          </Link>{" "}
          or open the{" "}
          <Link href={`/fi-admin/${tenantId}/calendar`} className="font-medium text-[#22C1FF] underline-offset-2 hover:underline">
            calendar
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-6">
          {order.map((bucket) => {
            const rows = agendaByBucket[bucket];
            if (rows.length === 0) return null;
            return (
              <div key={bucket}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#64748B]">{BUCKET_LABEL[bucket]}</h3>
                <ul className="mt-2 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#081020]/40">
                  {rows.map((row) => (
                    <li key={row.id} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#F8FAFC]">
                          {row.title?.trim() || "Booking"}
                          <span className="ml-2 text-xs font-normal text-[#64748B]">({row.booking_type})</span>
                        </p>
                        <p className="text-xs text-[#94A3B8]">
                          {formatSlot(row.start_at, row.timezone)} – {formatSlot(row.end_at, row.timezone)} ·{" "}
                          {row.booking_status}
                        </p>
                      </div>
                      <Link
                        href={bookingDetailHref(tenantId, row)}
                        className="shrink-0 text-xs font-semibold text-[#22C1FF] underline-offset-2 hover:underline sm:text-sm"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
