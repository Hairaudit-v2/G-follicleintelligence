import Link from "next/link";
import { BarChart3, Camera, ClipboardCheck, Globe2, Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { FI_DASHBOARD_WIDGET_LABELS } from "@/src/config/fiDashboardRegistry";
import type { TenantOutcomeIntelligenceSummary } from "@/src/lib/fi-os/outcomeIntelligence.server";

function MetricPill({
  href,
  label,
  value,
  icon,
}: {
  href: string;
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-white/[0.07] bg-[#0c1426]/70 px-3 py-3 shadow-inner shadow-black/20 backdrop-blur-sm transition",
        "hover:border-emerald-500/25 hover:bg-[#141c33]/80",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-emerald-400/90" aria-hidden>
          {icon}
        </span>
        <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight text-slate-50">{value}</p>
    </Link>
  );
}

export function DashboardOutcomeIntelligenceSummary(props: {
  tenantBase: string;
  summary: TenantOutcomeIntelligenceSummary;
}) {
  const b = props.tenantBase.replace(/\/+$/, "");
  const meta = FI_DASHBOARD_WIDGET_LABELS.outcome_intelligence_summary;
  const s = props.summary;
  const hasData =
    s.outcomesCapturedApprox > 0 ||
    s.twelveMonthCheckpointsCaptured > 0 ||
    s.imagingSignalsApprox > 0 ||
    s.auditScoreSignalsApprox > 0 ||
    s.globalBenchmarkRowsVisible > 0;

  const benchmarkLabel = s.globalBenchmarkRowsVisible > 0 ? `${s.globalBenchmarkRowsVisible} cohort row(s)` : "Pending thresholds";

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-outcome-intel-heading">
      <SectionHeader
        id="dash-outcome-intel-heading"
        kicker="Outcome intelligence"
        title={meta.title}
        description={meta.description}
      />
      {!hasData ? (
        <p className="mt-3 text-sm text-slate-400">
          Outcome intelligence will appear as follow-up measurements and audits are captured.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <MetricPill
            href={`${b}/cases`}
            label="Outcomes captured"
            value={s.outcomesCapturedApprox}
            icon={<Layers className="h-3.5 w-3.5" />}
          />
          <MetricPill
            href={`${b}/cases`}
            label="12-month checkpoints"
            value={`${s.twelveMonthCheckpointsCaptured}/${s.twelveMonthCheckpointsTotal}`}
            icon={<BarChart3 className="h-3.5 w-3.5" />}
          />
          <MetricPill
            href={`${b}/foundation-integrity`}
            label="Imaging available"
            value={s.imagingSignalsApprox}
            icon={<Camera className="h-3.5 w-3.5" />}
          />
          <MetricPill
            href={`${b}/audit`}
            label="Audit score available"
            value={s.auditScoreSignalsApprox}
            icon={<ClipboardCheck className="h-3.5 w-3.5" />}
          />
          <MetricPill href={`${b}/cases`} label="Network benchmark status" value={benchmarkLabel} icon={<Globe2 className="h-3.5 w-3.5" />} />
        </div>
      )}
    </DashboardCard>
  );
}
