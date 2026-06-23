import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type { SurgeryReadinessBoardPayload } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import { flattenReadinessCards } from "@/src/lib/fiAdmin/surgeryPresentation";

export function SurgeryReadinessSystemDiagnostics({
  tenantId,
  payload,
  showDiagnosticsExpanded = false,
}: {
  tenantId: string;
  payload: SurgeryReadinessBoardPayload;
  showDiagnosticsExpanded?: boolean;
}) {
  const all = flattenReadinessCards(payload);
  const columnCounts = Object.entries(payload.columns).map(([key, cards]) => ({
    key,
    count: cards.length,
  }));

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
              Raw readiness calculations, column distribution, and loader window internals.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-violet-300/80">
            {showDiagnosticsExpanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </summary>

      <div className="space-y-6 border-t border-white/[0.06] px-5 py-5 sm:px-6 sm:py-6">
        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Readiness board window"
            description="14-day tenant-local window from surgery readiness loader."
            className="mb-3"
          />
          <dl className="grid gap-2 text-sm text-[#94A3B8] sm:grid-cols-2">
            <div>
              <dt className="text-[#64748B]">Tenant</dt>
              <dd className="font-mono text-[#E2E8F0]">{tenantId}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Timezone</dt>
              <dd className="text-[#E2E8F0]">{payload.window.calendarTimezone}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Today (local)</dt>
              <dd className="text-[#E2E8F0]">{payload.window.todayYmd}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Window end</dt>
              <dd className="text-[#E2E8F0]">{payload.window.windowEndYmd}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[#64748B]">UTC range</dt>
              <dd className="font-mono text-xs text-[#CBD5E1]">
                {payload.window.rangeStartIso} → {payload.window.rangeEndIso}
              </dd>
            </div>
          </dl>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader title="Column distribution" description="Kanban column card counts (raw loader output)." className="mb-3" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {columnCounts.map(({ key, count }) => (
              <div key={key} className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm text-[#94A3B8]">
                <span className="font-medium text-[#CBD5E1]">{key}</span>
                <span className="ml-2 tabular-nums text-[#F8FAFC]">{count}</span>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader title="KPI aggregates" description="Manager filter KPIs from readiness model." className="mb-3" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Upcoming (14d)" value={payload.kpis.upcomingNext14Days} />
            <StatCard label="Ready" value={payload.kpis.ready} />
            <StatCard label="Needs attention" value={payload.kpis.needsAttention} />
            <StatCard label="High risk" value={payload.kpis.highRisk} />
            <StatCard label="Missing pathology" value={payload.kpis.missingPathology} />
            <StatCard label="Missing consent" value={payload.kpis.missingConsent} />
            <StatCard label="Deposits pending" value={payload.kpis.surgeryDepositsPending} />
            <StatCard label="Payment rows tracked" value={payload.kpis.surgeryPaymentRecordsTracked} />
          </div>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader title="Loaded cards" description={`${all.length} surgery readiness cards in window.`} className="mb-3" />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-white/[0.06]">
            <table className="min-w-full text-left text-xs text-[#94A3B8]">
              <thead className="sticky top-0 border-b border-white/[0.06] bg-[#0a101f] text-[0.62rem] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Booking</th>
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">Column</th>
                  <th className="px-3 py-2">Issues</th>
                </tr>
              </thead>
              <tbody>
                {all.map((c) => (
                  <tr key={c.bookingId} className="border-b border-white/[0.04]">
                    <td className="px-3 py-2 text-[#E2E8F0]">{c.patientLabel}</td>
                    <td className="px-3 py-2 font-mono text-[0.65rem]">{c.bookingId.slice(0, 8)}…</td>
                    <td className="px-3 py-2 font-mono text-[0.65rem]">{c.caseId?.slice(0, 8) ?? "—"}</td>
                    <td className="px-3 py-2">{c.primaryColumn}</td>
                    <td className="px-3 py-2">{c.issues.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </div>
    </details>
  );
}
