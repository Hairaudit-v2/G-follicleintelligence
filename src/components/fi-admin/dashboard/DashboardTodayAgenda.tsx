import Link from "next/link";
import { Calendar } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AgendaBucket, DashboardBookingItem } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardEmptyState } from "@/src/components/fi-admin/dashboard/DashboardEmptyState";

const BUCKET_LABEL: Record<AgendaBucket, string> = {
  consult: "Consultation",
  surgery: "Surgery",
  follow_up: "Follow-up",
  other: "Appointment",
};

const BUCKET_ACCENT: Record<AgendaBucket, string> = {
  consult: "border-cyan-500/40 bg-cyan-500/80",
  surgery: "border-orange-500/40 bg-orange-400/80",
  follow_up: "border-violet-500/40 bg-violet-400/80",
  other: "border-slate-500/40 bg-slate-400/80",
};

function formatDayLabel(iso: string, tz: string | null): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return new Intl.DateTimeFormat(undefined, {
    weekday: sameDay ? undefined : "short",
    month: "short",
    day: "numeric",
    timeZone: tz?.trim() || undefined,
  }).format(d);
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

function AgendaTimelineRow(props: { tenantId: string; row: DashboardBookingItem; bucket: AgendaBucket }) {
  const { tenantId, row, bucket } = props;
  const href = bookingDetailHref(tenantId, row);

  return (
    <li className="relative flex gap-4 pb-5 last:pb-0">
      <div className="flex w-16 shrink-0 flex-col items-end pt-0.5 text-right">
        <span className="font-mono text-sm font-semibold tabular-nums text-slate-200">
          {formatSlot(row.start_at, row.timezone)}
        </span>
        <span className="mt-0.5 text-[0.65rem] text-slate-500">{formatDayLabel(row.start_at, row.timezone)}</span>
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <span
          className={cn("absolute -left-[1.125rem] top-2 h-2.5 w-2.5 rounded-full border-2", BUCKET_ACCENT[bucket])}
          aria-hidden
        />
        <Link
          href={href}
          className={cn(
            "block rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 shadow-sm shadow-black/20 transition",
            "hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{row.title?.trim() || "Booking"}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {BUCKET_LABEL[bucket]} · {row.booking_status.replace(/_/g, " ")}
              </p>
            </div>
            <span className="shrink-0 text-xs font-medium text-cyan-400/90">
              {formatSlot(row.end_at, row.timezone)}
            </span>
          </div>
        </Link>
      </div>
    </li>
  );
}

export function DashboardTodayAgenda(props: {
  tenantId: string;
  agendaRange: { startIso: string; endIso: string };
  agendaByBucket: Record<AgendaBucket, DashboardBookingItem[]>;
  /** Control centre: larger focal panel, scrollable list region. */
  variant?: "default" | "launch";
  className?: string;
}) {
  const { tenantId, agendaByBucket, variant = "default", className } = props;
  const base = `/fi-admin/${tenantId}`;
  const flat = (["consult", "surgery", "follow_up", "other"] as AgendaBucket[])
    .flatMap((bucket) => agendaByBucket[bucket].map((row) => ({ bucket, row })))
    .sort((a, b) => a.row.start_at.localeCompare(b.row.start_at));
  const total = flat.length;

  return (
    <DashboardCard
      elevated={variant === "launch"}
      className={cn(
        "p-4 sm:p-5",
        variant === "launch" &&
          "flex min-h-[min(52vh,560px)] flex-col border-cyan-500/10 bg-gradient-to-b from-[#0b1528]/96 to-[#060d18]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
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
            ? "Upcoming appointments — tap any row to open the visit."
            : "Upcoming visits from today through the next 72 hours. Cancelled and completed bookings are hidden."
        }
        className="mb-4"
      />
      {total === 0 ? (
        <DashboardEmptyState
          className="mt-2 flex-1"
          icon={<Calendar className="h-5 w-5" aria-hidden />}
          title="No appointments scheduled"
          description="Your clinic calendar is clear for the next few days. Book the next visit to keep the day moving."
          actionLabel="Book appointment"
          actionHref={`${base}/calendar`}
        />
      ) : (
        <div className={cn("relative min-h-0", variant === "launch" && "flex-1 overflow-y-auto pr-1")}>
          <div className="absolute bottom-2 left-[4.35rem] top-2 w-px bg-white/[0.08]" aria-hidden />
          <ol className="relative space-y-0 pl-2">
            {flat.map(({ bucket, row }) => (
              <AgendaTimelineRow key={row.id} tenantId={tenantId} row={row} bucket={bucket} />
            ))}
          </ol>
        </div>
      )}
    </DashboardCard>
  );
}
