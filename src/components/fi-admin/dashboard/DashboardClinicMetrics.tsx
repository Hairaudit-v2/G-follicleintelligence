import Link from "next/link";
import { BarChart3, Percent, Scissors, Stethoscope, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { TenantLaunchControl, TenantQuickStats } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

function formatConversion(rate: number | null, won: number, closed: number): string {
  if (rate == null || closed === 0) return "—";
  return `${Math.round(rate * 100)}%`;
}

function MetricPill({
  href,
  label,
  value,
  foot,
  icon,
}: {
  href: string;
  label: string;
  value: string | number;
  foot?: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-white/[0.07] bg-[#0c1426]/70 px-3 py-3 shadow-inner shadow-black/20 backdrop-blur-sm transition",
        "hover:border-cyan-500/25 hover:bg-[#141c33]/80",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-cyan-400/90" aria-hidden>
          {icon}
        </span>
        <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-50">{value}</p>
      {foot ? <p className="mt-1 text-[0.65rem] text-slate-600">{foot}</p> : null}
    </Link>
  );
}

export function DashboardClinicMetrics(props: {
  base: string;
  quickStats: TenantQuickStats;
  launchControl: TenantLaunchControl;
}) {
  const { base, quickStats, launchControl } = props;
  const conversion = formatConversion(
    quickStats.conversionRateLast30d,
    quickStats.conversionWonLast30d,
    quickStats.conversionClosedLast30d,
  );
  const conversionFoot =
    quickStats.conversionClosedLast30d > 0
      ? `${quickStats.conversionWonLast30d} won / ${quickStats.conversionClosedLast30d} closed · 30d`
      : "30-day pipeline outcomes";

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-metrics-heading">
      <SectionHeader
        id="dash-metrics-heading"
        kicker="Performance"
        title="Clinic metrics"
        description="Lightweight KPIs for the week and month — open analytics for deeper reporting."
      />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricPill
          href={`${base}/crm`}
          label="New leads"
          value={quickStats.newLeadsThisWeek}
          foot="This week"
          icon={<UserPlus className="h-3.5 w-3.5" />}
        />
        <MetricPill
          href={`${base}/consultations`}
          label="Consultations"
          value={quickStats.openConsultations}
          foot="Open workspaces"
          icon={<Stethoscope className="h-3.5 w-3.5" />}
        />
        <MetricPill
          href={`${base}/crm`}
          label="Conversion"
          value={conversion}
          foot={conversionFoot}
          icon={<Percent className="h-3.5 w-3.5" />}
        />
        <MetricPill
          href={`${base}/cases`}
          label="Surgeries booked"
          value={launchControl.surgeriesThisWeek}
          foot="This week"
          icon={<Scissors className="h-3.5 w-3.5" />}
        />
        <MetricPill
          href={`${base}/analytics`}
          label="Revenue"
          value={launchControl.revenueAvailable ? "Live" : "—"}
          foot={launchControl.revenueAvailable ? "Connected" : "Billing not connected"}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
        />
      </div>
    </DashboardCard>
  );
}
