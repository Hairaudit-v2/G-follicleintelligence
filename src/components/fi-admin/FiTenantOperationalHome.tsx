import Link from "next/link";

import { DashboardTodayAgenda } from "@/src/components/fi-admin/dashboard/DashboardTodayAgenda";
import { DashboardUpcomingReminders } from "@/src/components/fi-admin/dashboard/DashboardUpcomingReminders";
import { DashboardStaleLeads } from "@/src/components/fi-admin/dashboard/DashboardStaleLeads";
import { DashboardTasksDue } from "@/src/components/fi-admin/dashboard/DashboardTasksDue";
import { DashboardQuickStats } from "@/src/components/fi-admin/dashboard/DashboardQuickStats";
import { DashboardQuickActions } from "@/src/components/fi-admin/dashboard/DashboardQuickActions";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export function FiTenantOperationalHome(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
}) {
  const { data, showCrmNav } = props;
  const base = `/fi-admin/${data.tenantId}`;

  return (
    <div className="space-y-8 pb-14 sm:space-y-10 sm:pb-16">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_280px_at_0%_0%,rgba(34,193,255,0.12),transparent_55%),radial-gradient(400px_200px_at_100%_100%,rgba(124,58,237,0.08),transparent_50%)]"
          aria-hidden
        />
        <div className="relative border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">Tenant home</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">{data.tenantName}</h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-[#94A3B8]">
            Operational overview for the next few days — bookings, CRM hygiene, tasks, and quick actions. Data is scoped to
            this tenant via server loaders.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link
              href={`${base}/cases`}
              className="inline-flex items-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF]"
            >
              Cases
            </Link>
            <Link
              href={`${base}/directory`}
              className="inline-flex items-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF]"
            >
              Directory
            </Link>
            <Link
              href={`${base}/configuration`}
              className="inline-flex items-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF]"
            >
              Configuration
            </Link>
          </div>
        </div>
      </DashboardCard>

      <DashboardTodayAgenda tenantId={data.tenantId} agendaRange={data.agendaRange} agendaByBucket={data.agendaByBucket} />

      <DashboardUpcomingReminders
        tenantId={data.tenantId}
        items={data.upcomingReminders}
        viewerFiUserId={data.viewerFiUserId}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardStaleLeads
          tenantId={data.tenantId}
          staleLeads={data.staleLeads}
          staleLeadThresholdDays={data.staleLeadThresholdDays}
        />
        <DashboardTasksDue tenantId={data.tenantId} tasks={data.tasksDue} viewerFiUserId={data.viewerFiUserId} />
      </div>

      <DashboardQuickStats tenantId={data.tenantId} stats={data.quickStats} />

      <DashboardQuickActions tenantId={data.tenantId} showCrmNav={showCrmNav} />
    </div>
  );
}
