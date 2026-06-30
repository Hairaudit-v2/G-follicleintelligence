import Link from "next/link";
import { UserPlus } from "lucide-react";

import type { StaleLeadItem } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardEmptyState } from "@/src/components/fi-admin/dashboard/DashboardEmptyState";

export function DashboardStaleLeads(props: {
  tenantId: string;
  staleLeads: StaleLeadItem[];
  staleLeadThresholdDays: number;
}) {
  const { tenantId, staleLeads, staleLeadThresholdDays } = props;

  return (
    <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="dash-stale-heading">
      <SectionHeader
        id="dash-stale-heading"
        kicker="CRM"
        title="Stale leads"
        description={`Open leads that have been in their current pipeline stage for more than ${staleLeadThresholdDays} days (from fi_crm_lead_stage_history, falling back to lead created_at when no stage entry exists).`}
        className="mb-4"
      />
      {staleLeads.length === 0 ? (
        <DashboardEmptyState
          icon={<UserPlus className="h-5 w-5" aria-hidden />}
          title="Pipeline is moving"
          description="No leads have been sitting in the same stage beyond your follow-up threshold."
          actionLabel="Open LeadFlow"
          actionHref={`/fi-admin/${tenantId}/crm`}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <caption className="sr-only">Stale leads sorted by longest time in stage</caption>
            <thead className="bg-[#081020]/80 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              <tr>
                <th scope="col" className="px-3 py-2.5">
                  Lead
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Stage
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Days
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {staleLeads.map((row) => (
                <tr key={row.leadId} className="bg-[#050a14]/40 hover:bg-[#081020]/60">
                  <td className="max-w-[14rem] px-3 py-2.5">
                    <p className="truncate font-medium text-[#F8FAFC]">{row.title}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[#94A3B8]">{row.stageLabel}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#F8FAFC]">
                    {row.daysInStage}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/fi-admin/${tenantId}/crm/leads/${row.leadId}`}
                      className="font-semibold text-[#22C1FF] underline-offset-2 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}
