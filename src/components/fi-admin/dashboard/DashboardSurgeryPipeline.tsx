import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardList, HeartPulse, Scissors, Stethoscope } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { FI_DASHBOARD_WIDGET_LABELS } from "@/src/config/fiDashboardRegistry";

/**
 * TODO(Stage 2 loader): Replace proxy counts with real SurgeryOS pipeline stages
 * (planning / ready / post-op) keyed off `fi_cases` + readiness + post-op tracking aggregates.
 * Current cards use the best available operational-dashboard fields only.
 */

function PipelinePill({
  href,
  label,
  value,
  foot,
  icon,
}: {
  href: string;
  label: string;
  value: number | string;
  foot?: string;
  icon: ReactNode;
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
      {foot ? <p className="mt-1 text-[0.65rem] leading-snug text-slate-600">{foot}</p> : null}
    </Link>
  );
}

export function DashboardSurgeryPipeline(props: {
  base: string;
  /** TODO: true “planning” queue — today: open consultations as pre-surgical funnel proxy. */
  planningProxyCount: number;
  /** TODO: booked vs readiness-qualified — today: week surgeries minus bookings missing a linked case. */
  readyForSurgeryApprox: number;
  /** TODO: `fi_case_post_op_tracking` pending aggregate — today: medication reorder reviews pending as clinical queue proxy. */
  postOpProxyCount: number;
  followUpsDue: number;
}) {
  const { base, planningProxyCount, readyForSurgeryApprox, postOpProxyCount, followUpsDue } = props;
  const meta = FI_DASHBOARD_WIDGET_LABELS.surgery_pipeline;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-surgery-pipeline-heading">
      <SectionHeader id="dash-surgery-pipeline-heading" kicker="Surgery" title={meta.title} description={meta.description} />
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <PipelinePill
          href={`${base}/consultations`}
          label="Planning"
          value={planningProxyCount}
          foot="Open consultations (proxy — see TODO above)"
          icon={<Stethoscope className="h-3.5 w-3.5" />}
        />
        <PipelinePill
          href={`${base}/cases`}
          label="Ready for surgery"
          value={readyForSurgeryApprox}
          foot="Week surgeries − missing case (approx.)"
          icon={<Scissors className="h-3.5 w-3.5" />}
        />
        <PipelinePill
          href={`${base}/cases`}
          label="Post-op pending"
          value={postOpProxyCount}
          foot="Medication reviews pending (proxy — see TODO above)"
          icon={<HeartPulse className="h-3.5 w-3.5" />}
        />
        <PipelinePill
          href={`${base}/calendar`}
          label="Follow-ups due"
          value={followUpsDue}
          foot="Next 14 days (action centre horizon)"
          icon={<ClipboardList className="h-3.5 w-3.5" />}
        />
      </div>
    </DashboardCard>
  );
}
