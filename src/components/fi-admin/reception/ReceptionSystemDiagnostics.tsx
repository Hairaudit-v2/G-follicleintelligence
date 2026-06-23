import Link from "next/link";

import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import { receptionColumnCounts } from "@/src/lib/fiAdmin/receptionBoardPresentation";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export function ReceptionSystemDiagnostics({
  data,
  showDiagnosticsExpanded = false,
}: {
  data: TenantOperationalDashboard;
  showDiagnosticsExpanded?: boolean;
}) {
  const base = `/fi-admin/${data.tenantId}`;
  const cards = data.receptionBoard.cards;
  const columnCounts = receptionColumnCounts(cards);
  const kpis = data.paymentCommercialKpis;

  return (
    <details
      className="rounded-2xl border border-white/[0.08] bg-[#0c1220]/60 backdrop-blur-sm"
      open={showDiagnosticsExpanded}
    >
      <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Operators</p>
            <h2 className="mt-1 text-lg font-semibold text-[#F8FAFC]">System diagnostics</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#94A3B8]">
              For platform operators only. These checks support reception board integrity and do not affect front-desk
              workflow.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-[#22C1FF]/80">
            {showDiagnosticsExpanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </summary>

      <div className="space-y-6 border-t border-white/[0.06] px-5 py-5 sm:px-6 sm:py-6">
        <DashboardCard className="p-4 sm:p-5">
          <SectionHeader
            kicker="Loader"
            title="Reception board counts"
            description="Raw column distribution for today's operational window."
            className="mb-4"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(columnCounts).map(([col, count]) => (
              <StatCard key={col} label={col.replace(/_/g, " ")} value={count} />
            ))}
            {Object.keys(columnCounts).length === 0 ? (
              <p className="col-span-full text-sm text-[#64748B]">No reception board cards loaded for today.</p>
            ) : null}
          </div>
        </DashboardCard>

        <DashboardCard className="p-4 sm:p-5">
          <SectionHeader
            kicker="Payments"
            title="Payment object details"
            description="Commercial KPI signals feeding reception readiness."
            className="mb-4"
          />
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Deposits due" value={kpis.depositsDueCount} />
            <StatCard label="Deposits paid today" value={kpis.depositsPaidTodayCount} />
            <StatCard label="Overdue payments" value={kpis.overduePaymentsCount} />
          </dl>
        </DashboardCard>

        <DashboardCard className="p-4 sm:p-5">
          <SectionHeader
            kicker="Bookings"
            title="Raw booking statuses"
            description="Per-card booking status and reception column mapping."
            className="mb-4"
          />
          {cards.length === 0 ? (
            <p className="text-sm text-[#64748B]">No cards to inspect.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
              {cards.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-[#94A3B8]"
                >
                  <span className="text-[#64748B]">{c.id.slice(0, 8)}…</span> · {c.bookingStatus} → {c.receptionColumn}
                  {c.roomLabel ? ` · room: ${c.roomLabel}` : ""}
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard className="p-4 sm:p-5">
          <SectionHeader
            kicker="Operational day"
            title="Loader window"
            description="UTC bounds used by the reception board loader."
            className="mb-4"
          />
          <dl className="space-y-2 font-mono text-xs text-[#94A3B8]">
            <div>
              <dt className="text-[#64748B]">todayYmd</dt>
              <dd>{data.operationalDay.todayYmd}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">calendarTimezone</dt>
              <dd>{data.operationalDay.calendarTimezone}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">localStartIso</dt>
              <dd className="break-all">{data.operationalDay.localStartIso}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">localEndIso</dt>
              <dd className="break-all">{data.operationalDay.localEndIso}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-[#64748B]">
            Tenant <span className="font-mono">{data.tenantId}</span> ·{" "}
            <Link href={`${base}/operations`} className="text-[#22C1FF]/80 hover:underline">
              Operations Centre
            </Link>
          </p>
        </DashboardCard>
      </div>
    </details>
  );
}
