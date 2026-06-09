import Link from "next/link";
import { Activity, Droplets, Scissors, Stethoscope } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { TenantClinicToday } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

function TodayTile({
  href,
  label,
  value,
  icon,
}: {
  href: string;
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 shadow-sm shadow-black/25 backdrop-blur-sm transition",
        "hover:-translate-y-0.5 hover:border-cyan-500/35 hover:bg-cyan-500/[0.08] hover:shadow-cyan-500/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/15 bg-cyan-500/10 text-cyan-400 transition group-hover:border-cyan-400/35">
          {icon}
        </span>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-50 sm:text-3xl">{value}</p>
    </Link>
  );
}

export function DashboardClinicToday(props: { base: string; clinicToday: TenantClinicToday }) {
  const { base, clinicToday } = props;
  const calendar = `${base}/calendar`;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-clinic-today-heading">
      <SectionHeader
        id="dash-clinic-today-heading"
        kicker="Today"
        title="Today's clinic"
        description="Scheduled activity for your clinic day — tap a tile to open the calendar."
      />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TodayTile
          href={calendar}
          label="Consultations"
          value={clinicToday.consultations}
          icon={<Stethoscope className="h-4 w-4" aria-hidden />}
        />
        <TodayTile
          href={calendar}
          label="PRP today"
          value={clinicToday.prp}
          icon={<Droplets className="h-4 w-4" aria-hidden />}
        />
        <TodayTile
          href={calendar}
          label="Follow-ups"
          value={clinicToday.followUps}
          icon={<Activity className="h-4 w-4" aria-hidden />}
        />
        <TodayTile
          href={calendar}
          label="Surgeries"
          value={clinicToday.surgeries}
          icon={<Scissors className="h-4 w-4" aria-hidden />}
        />
      </div>
    </DashboardCard>
  );
}
