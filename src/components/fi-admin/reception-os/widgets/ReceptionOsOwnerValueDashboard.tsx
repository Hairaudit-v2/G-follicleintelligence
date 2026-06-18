"use client";

import { DollarSign, Gauge, ShieldCheck, Sparkles, Timer, TrendingUp, Users } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { cn } from "@/lib/utils";
import type { ReceptionOwnerValueDashboard } from "@/src/lib/receptionOs/receptionOwnerValueModel";

type ReceptionOsOwnerValueDashboardProps = {
  dashboard: ReceptionOwnerValueDashboard;
  periodDays: number;
};

export function ReceptionOsOwnerValueDashboardWidget({
  dashboard,
  periodDays,
}: ReceptionOsOwnerValueDashboardProps) {
  const currency = dashboard.currency;

  return (
    <DashboardCard className="overflow-hidden border-emerald-500/20">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Owner value dashboard"
          description={`Commercial readiness metrics for clinic owners and directors (last ${periodDays} days)`}
        />
      </div>

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
        <ValueTile
          icon={DollarSign}
          label="Estimated revenue protected"
          value={formatMoney(dashboard.estimatedRevenueProtected, currency)}
        />
        <ValueTile icon={ShieldCheck} label="Operational risks closed" value={String(dashboard.operationalRisksClosed)} />
        <ValueTile
          icon={Timer}
          label="Average response time"
          value={
            dashboard.averageResponseTimeMinutes != null
              ? `${dashboard.averageResponseTimeMinutes} min`
              : "—"
          }
        />
        <ValueTile icon={TrendingUp} label="Conversion actions taken" value={String(dashboard.conversionActionsTaken)} />
        <ValueTile icon={Users} label="Staff adoption score" value={`${dashboard.staffAdoptionScore}%`} />
        <ValueTile icon={Sparkles} label="Pilot feedback score" value={`${dashboard.pilotFeedbackScore}%`} />
      </div>
    </DashboardCard>
  );
}

function ValueTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-emerald-400/80" aria-hidden />
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      </div>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums text-slate-50")}>{value}</p>
    </div>
  );
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}
