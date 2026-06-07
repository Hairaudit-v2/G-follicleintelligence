import Link from "next/link";

import { cn } from "@/lib/utils";
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
  /** Control centre: larger focal panel, scrollable list region. */
  variant?: "default" | "launch";
  className?: string;
}) {
  const { tenantId, agendaRange, agendaByBucket, variant = "default", className } = props;
  const total =
    agendaByBucket.consult.length +
    agendaByBucket.surgery.length +
    agendaByBucket.follow_up.length +
    agendaByBucket.other.length;

  const order: AgendaBucket[] = ["consult", "surgery", "follow_up", "other"];

  return (
    <DashboardCard
      elevated={variant === "launch"}
      className={cn(
        "p-4 sm:p-4",
        variant === "launch" &&
          "flex min-h-[min(48vh,520px)] flex-col border-cyan-500/10 bg-gradient-to-b from-[#0b1528]/96 to-[#060d18]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
        className,
      )}
      role="region"
      aria-labelledby="dash-agenda-heading"
    >
      <SectionHeader
        id="dash-agenda-heading"
        kicker="Schedule"
        title={variant === "launch" ? "Today's schedule" : "Today's agenda"}
        description={
          variant === "launch"
            ? "Next 72 hours — confirmed activity (cancelled & completed hidden)."
            : `Upcoming visits from midnight UTC today through the next 72 hours (${formatRangeLabel(agendaRange.startIso, agendaRange.endIso)}). Cancelled and completed bookings are hidden.`
        }
        className="mb-3"
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
        <div className={cn(variant === "launch" && "min-h-0 flex-1 overflow-y-auto pr-1")}>
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
        </div>
      )}
    </DashboardCard>
  );
}
