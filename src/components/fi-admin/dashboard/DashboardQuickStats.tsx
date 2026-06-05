import Link from "next/link";
import { CalendarX, ClipboardList, Percent, UserPlus } from "lucide-react";

import type { TenantQuickStats } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";

const ICON = 22;

function formatPct(ratio: number | null): string {
  if (ratio == null) return "—";
  return `${Math.round(ratio * 100)}%`;
}

export function DashboardQuickStats(props: {
  tenantId: string;
  stats: TenantQuickStats;
}) {
  const { tenantId, stats } = props;

  return (
    <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="dash-stats-heading">
      <SectionHeader
        id="dash-stats-heading"
        kicker="Snapshot"
        title="Quick stats"
        description="Counts for this tenant: new leads this calendar week (UTC), conversion from recent terminal stage moves, open consultations, and today's no-shows."
        className="mb-4"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="New leads (week)"
          value={stats.newLeadsThisWeek}
          icon={<UserPlus size={ICON} strokeWidth={1.75} />}
        />
        <StatCard
          label="Conversion (30d)"
          value={formatPct(stats.conversionRateLast30d)}
          icon={<Percent size={ICON} strokeWidth={1.75} />}
        />
        <StatCard
          label="Open consultations"
          value={stats.openConsultations}
          icon={<ClipboardList size={ICON} strokeWidth={1.75} />}
        />
        <StatCard
          label="Today's no-shows"
          value={stats.todaysNoShows}
          icon={<CalendarX size={ICON} strokeWidth={1.75} />}
        />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[#64748B]">
        Conversion uses the most recent won/lost stage transition per lead in the last 30 days (
        {stats.conversionWonLast30d} won / {stats.conversionClosedLast30d} closed).{" "}
        <Link className="text-[#22C1FF] underline-offset-2 hover:underline" href={`/fi-admin/${tenantId}/consultations`}>
          Consultations
        </Link>{" "}
        and{" "}
        <Link className="text-[#22C1FF] underline-offset-2 hover:underline" href={`/fi-admin/${tenantId}/crm`}>
          CRM
        </Link>{" "}
        for detail.
      </p>
    </DashboardCard>
  );
}
