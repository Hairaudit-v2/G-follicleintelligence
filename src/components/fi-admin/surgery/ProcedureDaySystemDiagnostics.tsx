import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type { ProcedureDayBoardPayload } from "@/src/lib/surgery/procedureDayBoardLoader.server";

export function ProcedureDaySystemDiagnostics({
  payload,
  showDiagnosticsExpanded = false,
}: {
  payload: ProcedureDayBoardPayload;
  showDiagnosticsExpanded?: boolean;
}) {
  const flat = payload.scheduleGroups.flatMap((g) => g.cards);

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
              Raw surgery day counts, procedure progress internals, and loader debug.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-violet-300/80">
            {showDiagnosticsExpanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </summary>

      <div className="space-y-6 border-t border-white/[0.06] px-5 py-5 sm:px-6 sm:py-6">
        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader title="Procedure day window" description="Tenant-local today window from procedure day loader." className="mb-3" />
          <dl className="grid gap-2 text-sm text-[#94A3B8] sm:grid-cols-2">
            <div>
              <dt className="text-[#64748B]">Tenant</dt>
              <dd className="font-mono text-[#E2E8F0]">{payload.tenantId}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Timezone</dt>
              <dd className="text-[#E2E8F0]">{payload.window.calendarTimezone}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Today (local)</dt>
              <dd className="text-[#E2E8F0]">{payload.window.todayYmd}</dd>
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
          <SectionHeader title="Summary counts" description="Aggregate surgery day summary from board model." className="mb-3" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Surgeries today" value={payload.summary.surgeriesToday} />
            <StatCard label="Ready" value={payload.summary.ready} />
            <StatCard label="In progress" value={payload.summary.inProgress} />
            <StatCard label="Completed" value={payload.summary.completed} />
            <StatCard label="High-risk readiness" value={payload.summary.highRiskReadinessIssues} />
            <StatCard label="Unassigned team" value={payload.summary.unassignedSurgeonOrTeam} />
            <StatCard label="Missing room" value={payload.summary.missingRoom} />
            <StatCard label="Action queue" value={payload.actions.length} />
          </div>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader title="Procedure progress buckets" description="fi_case_procedures status distribution." className="mb-3" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Scheduled" value={payload.procedureProgressCounts.scheduled} />
            <StatCard label="In progress" value={payload.procedureProgressCounts.inProgress} />
            <StatCard label="Completed" value={payload.procedureProgressCounts.completed} />
            <StatCard label="Cancelled" value={payload.procedureProgressCounts.cancelled} />
          </div>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader title="Schedule cards" description={`${flat.length} surgery bookings loaded for today.`} className="mb-3" />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-white/[0.06]">
            <table className="min-w-full text-left text-xs text-[#94A3B8]">
              <thead className="sticky top-0 border-b border-white/[0.06] bg-[#0a101f] text-[0.62rem] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Booking</th>
                  <th className="px-3 py-2">Pipeline</th>
                  <th className="px-3 py-2">Procedure status</th>
                </tr>
              </thead>
              <tbody>
                {flat.map((c) => (
                  <tr key={c.bookingId} className="border-b border-white/[0.04]">
                    <td className="px-3 py-2 text-[#E2E8F0]">{c.patientLabel}</td>
                    <td className="px-3 py-2 font-mono text-[0.65rem]">{c.bookingId.slice(0, 8)}…</td>
                    <td className="px-3 py-2">{c.pipelinePhase}</td>
                    <td className="px-3 py-2">{c.procedureProgress.statusRaw ?? "—"}</td>
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
