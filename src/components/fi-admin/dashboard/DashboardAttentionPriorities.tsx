import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardEmptyState } from "@/src/components/fi-admin/dashboard/DashboardEmptyState";
import { buildAttentionPriorities } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";
import type { TenantActionCentre } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

const severityDot: Record<string, string> = {
  critical: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.45)]",
  warning: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.35)]",
  normal: "bg-cyan-400/80",
};

export function DashboardAttentionPriorities(props: {
  base: string;
  actionCentre: TenantActionCentre;
  showCrmNav: boolean;
}) {
  const { base, actionCentre, showCrmNav } = props;
  const items = buildAttentionPriorities({ base, actionCentre, showCrmNav, maxItems: 5 });

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-attention-priorities-heading">
      <SectionHeader
        id="dash-attention-priorities-heading"
        kicker="Priority"
        title="What needs attention"
        description="Top operational priorities for the clinic — open the linked workspace to resolve."
      />
      {items.length === 0 ? (
        <DashboardEmptyState
          className="mt-4 max-w-xl py-5 sm:px-6 sm:py-6"
          title="Clinic is clear"
          description="No urgent operational priorities need action right now."
          actionLabel="Open Operations Centre"
          actionHref={`${base}/operations`}
        />
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-3 transition sm:px-4",
                  item.severity === "critical"
                    ? "border-red-400/30 bg-red-950/25 hover:border-red-300/45 hover:bg-red-950/35"
                    : item.severity === "warning"
                      ? "border-orange-400/25 bg-orange-950/15 hover:border-orange-300/40 hover:bg-orange-950/25"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-cyan-500/20 hover:bg-white/[0.04]",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] font-mono text-xs font-semibold text-slate-400">
                  {index + 1}
                </span>
                <span className={cn("h-2 w-2 shrink-0 rounded-full", severityDot[item.severity])} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-slate-100">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{item.detail}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
