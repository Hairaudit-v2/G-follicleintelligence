import Link from "next/link";
import { Activity, Camera, ClipboardList, FlaskConical, HeartPulse } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { FI_DASHBOARD_WIDGET_LABELS } from "@/src/config/fiDashboardRegistry";
import type { TenantClinicalIntelligenceSummary } from "@/src/lib/fi-os/clinicalIntelligence.server";

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
    </Link>
  );
}

export function DashboardClinicalIntelligenceSummary(props: {
  tenantBase: string;
  summary: TenantClinicalIntelligenceSummary;
}) {
  const b = props.tenantBase.replace(/\/+$/, "");
  const meta = FI_DASHBOARD_WIDGET_LABELS.clinical_intelligence_summary;
  const s = props.summary;
  const hasData =
    s.readinessAttention > 0 ||
    s.followUpsOverdue > 0 ||
    s.pathologyPendingReview > 0 ||
    s.imagingGapsApprox > 0 ||
    s.outcomeDataMissingApprox > 0;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-clinical-intel-heading">
      <SectionHeader
        id="dash-clinical-intel-heading"
        kicker="Journey signals"
        title={meta.title}
        description={meta.description}
      />
      {!hasData ? (
        <p className="mt-3 text-sm text-slate-400">
          Clinical intelligence will surface patient journey and outcome signals as activity builds.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <MetricPill
            href={`${b}/surgery-readiness`}
            label="Readiness attention"
            value={s.readinessAttention}
            icon={<Activity className="h-3.5 w-3.5" />}
          />
          <MetricPill
            href={`${b}/calendar`}
            label="Follow-ups overdue"
            value={s.followUpsOverdue}
            icon={<HeartPulse className="h-3.5 w-3.5" />}
          />
          <MetricPill
            href={`${b}/cases`}
            label="Pathology pending"
            value={s.pathologyPendingReview}
            icon={<FlaskConical className="h-3.5 w-3.5" />}
          />
          <MetricPill
            href={`${b}/foundation-integrity`}
            label="Imaging gaps"
            value={s.imagingGapsApprox}
            icon={<Camera className="h-3.5 w-3.5" />}
          />
          <MetricPill
            href={`${b}/cases`}
            label="Outcome data missing"
            value={s.outcomeDataMissingApprox}
            icon={<ClipboardList className="h-3.5 w-3.5" />}
          />
        </div>
      )}
    </DashboardCard>
  );
}
