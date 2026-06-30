import { Activity, ShieldCheck } from "lucide-react";

import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type {
  AuditActivityRow,
  AuditDashboardSnapshot,
  AuditQueueItem,
} from "@/src/lib/fiAdmin/auditDashboardTypes";
import { formatAuditDateTime } from "@/src/lib/fiAdmin/auditIntelligencePresentation";

function formatShortId(id: string): string {
  const t = id.trim();
  if (t.length <= 10) return t;
  return `${t.slice(0, 8)}…`;
}

function queueStatusBadgeClass(status: string): string {
  if (status === "draft") return "bg-sky-500/15 text-sky-200 ring-sky-500/30";
  if (status === "changes_required") return "bg-amber-500/15 text-amber-100 ring-amber-400/35";
  return "bg-white/[0.06] text-[#CBD5E1] ring-white/10";
}

function activityStatusLabel(status: string): string {
  if (status === "approved") return "Issued";
  if (status === "changes_required") return "Changes required";
  return status;
}

export function AuditOsSystemDiagnostics({
  snapshot,
  showDiagnosticsExpanded = false,
}: {
  snapshot: AuditDashboardSnapshot;
  showDiagnosticsExpanded?: boolean;
}) {
  const { kpis, queue, recent_audit_activity, pipeline } = snapshot;
  const pipelineBusy = pipeline.model_runs.queued + pipeline.model_runs.running > 0;
  const pipelineHasFailures = pipeline.model_runs.failed > 0;

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
              For platform operators only. These checks support audit intelligence integrity and do
              not affect day-to-day clinical review.
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
            title="Report pipeline status"
            description="fi_model_runs job counts and fi_scorecards totals for this tenant (read-only)."
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Runs queued" value={pipeline.model_runs.queued} />
            <StatCard label="Runs running" value={pipeline.model_runs.running} />
            <StatCard label="Runs failed" value={pipeline.model_runs.failed} />
            <StatCard label="Runs complete" value={pipeline.model_runs.complete} />
          </div>
          <p className="mt-4 text-sm text-[#94A3B8]">
            <span className="font-semibold text-[#F8FAFC]">{pipeline.scorecards_total}</span>{" "}
            scorecard
            {pipeline.scorecards_total === 1 ? "" : "s"} recorded (fi_scorecards).
          </p>
          {(pipelineBusy || pipelineHasFailures) && (
            <p className="mt-2 text-xs text-amber-200/90">
              {pipelineHasFailures
                ? "Failed model runs may delay report generation — investigate before clinical review."
                : "Background jobs are active — counts refresh on reload."}
            </p>
          )}
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Internal KPI breakdown"
            description="Raw fi_reports status counts used by the clinical health cards above."
            className="mb-3"
          />
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Draft reports", value: kpis.draft_reports },
              { label: "Changes required", value: kpis.changes_required_reports },
              { label: "Released reports", value: kpis.released_reports },
              { label: "Pending reviews", value: kpis.pending_reviews },
              {
                label: "Oldest queue item",
                value: kpis.oldest_queue_created_at
                  ? formatAuditDateTime(kpis.oldest_queue_created_at)
                  : "—",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-lg border border-white/[0.06] bg-[#0c1220]/80 px-3 py-2"
              >
                <dt className="text-xs text-[#64748B]">{row.label}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-[#F8FAFC]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Audit queue (technical)"
            description="Reports in draft or changes-required status with internal identifiers."
            className="mb-3"
          />
          {queue.length === 0 ? (
            <p className="text-sm text-[#64748B]">No items in the audit queue.</p>
          ) : (
            <QueueTable queue={queue} />
          )}
        </DashboardCard>

        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <SectionHeader
            title="Recent audit activity (fi_audits)"
            description="Latest approve / reject decisions with report and case identifiers."
            className="mb-3"
          />
          {recent_audit_activity.length === 0 ? (
            <p className="text-sm text-[#64748B]">No audit decisions recorded.</p>
          ) : (
            <ActivityList rows={recent_audit_activity} />
          )}
        </DashboardCard>

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0c1220]/40 px-4 py-3 text-xs text-[#64748B]">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          <p>
            Diagnostics expose internal identifiers and job state for operators. Clinical staff
            should use the sections above.
          </p>
          <Activity className="ml-auto h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </div>
      </div>
    </details>
  );
}

function QueueTable({ queue }: { queue: AuditQueueItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] bg-[#0c1220]/90 text-xs uppercase tracking-wide text-[#64748B]">
            <th className="px-3 py-2.5 font-semibold">Report ID</th>
            <th className="px-3 py-2.5 font-semibold">Case ID</th>
            <th className="px-3 py-2.5 font-semibold">Patient</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 font-semibold">Created</th>
            <th className="px-3 py-2.5 font-semibold">Ver.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {queue.map((q) => (
            <tr key={q.report_id} className="hover:bg-white/[0.02]">
              <td className="px-3 py-2.5 font-mono text-xs text-[#94A3B8]">
                {formatShortId(q.report_id)}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-[#94A3B8]">
                {formatShortId(q.case_id)}
              </td>
              <td className="max-w-[220px] px-3 py-2.5 text-[#CBD5E1]">
                <span className="block truncate font-medium">
                  {q.patient?.full_name?.trim() || "—"}
                </span>
                <span className="block truncate text-xs text-[#64748B]">
                  {q.patient?.email?.trim() || "—"}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${queueStatusBadgeClass(q.report_status)}`}
                >
                  {q.report_status}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-[#94A3B8]">
                {formatAuditDateTime(q.created_at)}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[#94A3B8]">
                {q.version}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityList({ rows }: { rows: AuditActivityRow[] }) {
  return (
    <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                  row.status === "approved"
                    ? "bg-emerald-500/15 text-emerald-100 ring-emerald-500/30"
                    : "bg-amber-500/15 text-amber-100 ring-amber-400/35"
                }`}
              >
                {activityStatusLabel(row.status)}
              </span>
              <span className="text-xs text-[#64748B]">{formatAuditDateTime(row.created_at)}</span>
            </div>
            <p className="mt-1 font-mono text-xs text-[#94A3B8]">
              Report {formatShortId(row.report_id)} · Case {formatShortId(row.case_id)}
            </p>
            {row.note ? (
              <p className="mt-1 text-xs text-[#CBD5E1] line-clamp-2">{row.note}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
