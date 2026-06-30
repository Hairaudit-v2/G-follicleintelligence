import { Activity, BarChart3, ShieldCheck } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { AnalyticsExecutiveDashboardPayload } from "@/src/lib/analytics-os/analyticsExecutiveTypes";
import type { AnalyticsOsDashboardPayload } from "@/src/lib/fiAdmin/analyticsOsDashboardTypes";

function formatPeriodDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function analyticsConfidenceLabel(
  level: AnalyticsExecutiveDashboardPayload["snapshot"]["analyticsConfidence"]
): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

function coverageStatusLabel(status: "active" | "limited" | "waiting"): string {
  if (status === "active") return "Active";
  if (status === "limited") return "Limited";
  return "Waiting";
}

export function AnalyticsOsSystemDiagnostics({
  model,
  executive,
  showDiagnosticsExpanded = false,
}: {
  model: AnalyticsOsDashboardPayload;
  executive: AnalyticsExecutiveDashboardPayload;
  showDiagnosticsExpanded?: boolean;
}) {
  const { snapshot, loadNotes: executiveLoadNotes } = executive;
  const found = model.foundation.state === "ok" ? model.foundation.data : null;
  const totalEvents = snapshot.metrics.find((m) => m.key === "total_events")?.value ?? 0;
  const activeModules = snapshot.metrics.find((m) => m.key === "active_modules")?.value ?? 0;

  return (
    <details
      className="rounded-2xl border border-white/[0.08] bg-[#0c1220]/60 backdrop-blur-sm"
      open={showDiagnosticsExpanded}
    >
      <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              Operators
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#F8FAFC]">System diagnostics</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#94A3B8]">
              For platform operators only. These checks support analytics integrity and do not
              affect day-to-day clinic workflows.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-[#22C1FF]/80">
            {showDiagnosticsExpanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </summary>

      <div className="space-y-6 border-t border-white/[0.06] px-5 py-5 sm:px-6 sm:py-6">
        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Analytics integrity"
            description={`Period ${formatPeriodDate(snapshot.periodStart)} – ${formatPeriodDate(snapshot.periodEnd)}`}
            className="mb-3"
          />
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2">
              <dt className="text-xs text-[#64748B]">Analytics confidence</dt>
              <dd className="mt-1 text-sm font-semibold text-[#F8FAFC]">
                {analyticsConfidenceLabel(snapshot.analyticsConfidence)}
              </dd>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2">
              <dt className="text-xs text-[#64748B]">Analytics event count</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-[#F8FAFC]">
                {totalEvents}
              </dd>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2">
              <dt className="text-xs text-[#64748B]">Active publishing modules</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-[#F8FAFC]">
                {activeModules}
              </dd>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2">
              <dt className="text-xs text-[#64748B]">Generated</dt>
              <dd className="mt-1 text-sm font-semibold text-[#F8FAFC]">
                {formatPeriodDate(snapshot.generatedAt)}
              </dd>
            </div>
          </dl>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Module event coverage"
            description="Publisher coverage for the selected period (Active &gt;20 events, Limited 1–19, Waiting 0)."
            className="mb-3"
          />
          <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/[0.08] bg-[#0c1220]/90 text-xs uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Module</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Event count</th>
                  <th className="px-4 py-3 font-semibold">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.moduleCoverage.map((row) => (
                  <tr key={row.moduleName} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-4 py-3 font-medium text-[#F8FAFC]">{row.displayLabel}</td>
                    <td className="px-4 py-3 text-[#CBD5E1]">{coverageStatusLabel(row.status)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#94A3B8]">
                      {row.eventCount} event{row.eventCount === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">
                      {row.lastEventAt ? formatPeriodDate(row.lastEventAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        {executiveLoadNotes.length || model.loadNotes.length ? (
          <DashboardCard className="border-amber-500/25 bg-amber-950/20 p-4 sm:p-5">
            <div className="flex gap-2">
              <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-200/90" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-100">Ingestion & load notes</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-amber-50/90">
                  {[...executiveLoadNotes, ...model.loadNotes].map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          </DashboardCard>
        ) : null}

        {found?.scan_notes?.length ? (
          <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
            <SectionHeader
              title="Foundation scan notes"
              description="Internal scan caveats from FoundationOS."
              className="mb-2"
            />
            <ul className="list-disc space-y-1 pl-5 text-xs text-[#94A3B8]">
              {found.scan_notes.slice(0, 8).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </DashboardCard>
        ) : null}

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0c1220]/40 px-4 py-3 text-xs text-[#64748B]">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          <p>
            Diagnostics use aggregate counts and scores only. Raw event metadata is not exposed in
            this view.
          </p>
          <Activity className="ml-auto h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </div>
      </div>
    </details>
  );
}
