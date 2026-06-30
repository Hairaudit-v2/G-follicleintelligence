import Link from "next/link";
import { Activity, HelpCircle, Scissors, Stethoscope } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { countAgendaBookingsOnOperationalDayByBucket } from "@/src/components/fi-admin/operations/operationsAgendaDayStats";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

const BUCKET_META: {
  key: keyof ReturnType<typeof countAgendaBookingsOnOperationalDayByBucket>;
  label: string;
  icon: typeof Stethoscope;
}[] = [
  { key: "consult", label: "Consults", icon: Stethoscope },
  { key: "surgery", label: "Surgery", icon: Scissors },
  { key: "follow_up", label: "Follow-up / review", icon: Activity },
  { key: "other", label: "Other", icon: HelpCircle },
];

export function OperationsTodayPatientFlow(props: {
  base: string;
  data: Pick<TenantOperationalDashboard, "agendaByBucket" | "operationalDay">;
}) {
  const { base, data } = props;
  const { todayYmd, calendarTimezone } = data.operationalDay;
  const counts = countAgendaBookingsOnOperationalDayByBucket(
    data.agendaByBucket,
    todayYmd,
    calendarTimezone
  );
  const total = BUCKET_META.reduce((acc, { key }) => acc + counts[key], 0);

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="ops-patient-flow-heading">
      <SectionHeader
        id="ops-patient-flow-heading"
        kicker="Flow"
        title="Patient flow (today)"
        description={`Bookings on ${todayYmd} (${calendarTimezone}) within the same agenda feed as the home dashboard.`}
        className="mb-4"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BUCKET_META.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`${base}/calendar`}
            className={cn(
              "flex flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 shadow-sm shadow-black/25 transition",
              "hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {label}
              </p>
              <Icon className="h-4 w-4 shrink-0 text-cyan-400/90" aria-hidden />
            </div>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-slate-50">
              {counts[key]}
            </p>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Total today in window: <span className="font-mono text-slate-300">{total}</span> · Open{" "}
        <Link
          className="text-cyan-400/90 underline-offset-2 hover:underline"
          href={`${base}/calendar`}
        >
          calendar
        </Link>{" "}
        for detail.
      </p>
    </DashboardCard>
  );
}
