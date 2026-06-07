"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClipboardList, ListChecks, Users } from "lucide-react";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiEmptyState } from "@/src/components/fi-design/FiEmptyState";
import { FiKpiTile } from "@/src/components/fi-design/FiKpiTile";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";
import type {
  AuditActivityRow,
  AuditDashboardKpis,
  AuditPipelineSnapshot,
  AuditQueueItem,
} from "@/src/lib/fiAdmin/auditDashboardTypes";

type DashboardResponse =
  | ({ ok: true } & {
      kpis: AuditDashboardKpis;
      queue: AuditQueueItem[];
      recent_audit_activity: AuditActivityRow[];
      pipeline: AuditPipelineSnapshot;
    })
  | { ok: false; error?: string };

function formatShortId(id: string): string {
  const t = id.trim();
  if (t.length <= 10) return t;
  return `${t.slice(0, 8)}…`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatOldestQueue(kpis: AuditDashboardKpis): { value: string; description: string } {
  if (kpis.pending_reviews === 0) {
    return { value: "—", description: "No items in the audit queue" };
  }
  if (!kpis.oldest_queue_created_at) {
    return { value: "—", description: "Oldest draft or changes-required report" };
  }
  const d = new Date(kpis.oldest_queue_created_at);
  const now = Date.now();
  const ageMs = now - d.getTime();
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const ageLabel = days >= 1 ? `${days}d in queue` : "< 1d in queue";
  return {
    value: d.toLocaleDateString(undefined, { dateStyle: "medium" }),
    description: `${ageLabel} · oldest draft or changes-required`,
  };
}

function activityStatusLabel(status: string): string {
  if (status === "approved") return "Issued";
  if (status === "changes_required") return "Changes required";
  return status;
}

function queueStatusBadgeClass(status: string): string {
  if (status === "draft") return "bg-sky-100 text-sky-900 ring-sky-200/80";
  if (status === "changes_required") return "bg-amber-100 text-amber-950 ring-amber-200/80";
  return "bg-slate-100 text-slate-800 ring-slate-200/80";
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <FiCard>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </FiCard>
  );
}

export function AuditOsDashboard() {
  const params = useParams();
  const tenantId = (params.tenantId as string)?.trim() ?? "";
  const base = `/fi-admin/${tenantId}`;

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    fetch(`/api/fi/audit/dashboard?tenant_id=${encodeURIComponent(tenantId)}`)
      .then((r) => r.json() as Promise<DashboardResponse>)
      .then(setData)
      .catch(() => setData({ ok: false, error: "Request failed." }))
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!tenantId) {
    return <p className="text-sm text-slate-500">Missing tenant.</p>;
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-500">
        Loading AuditOS…
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <FiEmptyState
        title="Could not load dashboard"
        description={data && !data.ok ? (data.error ?? "Unknown error.") : "No response from server."}
        action={
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            Retry
          </button>
        }
      />
    );
  }

  const { kpis, queue, recent_audit_activity, pipeline } = data;
  const oldest = formatOldestQueue(kpis);
  const hasAnyReports =
    kpis.draft_reports + kpis.changes_required_reports + kpis.released_reports > 0;
  const pipelineBusy = pipeline.model_runs.queued + pipeline.model_runs.running > 0;
  const pipelineHasFailures = pipeline.model_runs.failed > 0;

  return (
    <div className="space-y-6">
      <FiPageHeader
        eyebrow="FI OS"
        title="AuditOS"
        description="Read-only overview of the HairAudit-style report queue, human audit trail, and FI scoring pipeline for this tenant. Open a report to approve, reject, or review — workflows are unchanged."
        titleId="auditos-dashboard-heading"
      />

      {!hasAnyReports &&
      recent_audit_activity.length === 0 &&
      pipeline.scorecards_total === 0 &&
      pipeline.model_runs.complete === 0 ? (
        <FiEmptyState
          title="No audit data yet"
          description="When reports are generated or auditors act, KPIs, queue rows, activity, and pipeline counts will appear here. SurgeryOS cases can feed the report pipeline after ingest."
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <FiKpiTile label="Draft reports" value={String(kpis.draft_reports)} description="Awaiting review" tone="info" />
        <FiKpiTile
          label="Changes required"
          value={String(kpis.changes_required_reports)}
          description="Returned to pipeline or data"
          tone={kpis.changes_required_reports > 0 ? "warning" : "neutral"}
        />
        <FiKpiTile
          label="Released reports"
          value={String(kpis.released_reports)}
          description="Issued (immutable)"
          tone="success"
        />
        <FiKpiTile
          label="Pending reviews"
          value={String(kpis.pending_reviews)}
          description="Draft + changes required"
          tone={kpis.pending_reviews > 0 ? "warning" : "neutral"}
        />
        <FiKpiTile label="Oldest queue item" value={oldest.value} description={oldest.description} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <SectionCard
            title="Audit queue"
            description="Reports in draft or changes-required status. Select a row to open the existing review screen."
          >
            <div id="audit-queue" className="scroll-mt-24">
              {queue.length === 0 ? (
                <FiEmptyState
                  title="Queue is clear"
                  description="No reports are waiting for audit right now. New drafts appear here after the FI report pipeline produces them."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/90">
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Report</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Case</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Patient</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Status</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Created</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Ver.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {queue.map((q) => (
                        <tr key={q.report_id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2.5 align-top">
                            <Link
                              href={`${base}/audit/${q.report_id}`}
                              className="font-medium text-sky-700 hover:underline"
                            >
                              {formatShortId(q.report_id)}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <Link
                              href={`${base}/cases/${q.case_id}`}
                              className="text-sky-700 hover:underline"
                              title="Open case in SurgeryOS"
                            >
                              {formatShortId(q.case_id)}
                            </Link>
                          </td>
                          <td className="max-w-[220px] px-3 py-2.5 align-top text-slate-700">
                            <span className="block truncate font-medium">{q.patient?.full_name?.trim() || "—"}</span>
                            <span className="block truncate text-xs text-slate-500">{q.patient?.email?.trim() || "—"}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${queueStatusBadgeClass(q.report_status)}`}
                            >
                              {q.report_status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-top text-slate-600">{formatDateTime(q.created_at)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-600">{q.version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Recent audit activity"
            description="Latest rows from fi_audits (approve / reject decisions)."
          >
            {recent_audit_activity.length === 0 ? (
              <FiEmptyState
                title="No audit decisions recorded"
                description="Approvals and rejections append to the audit trail when reviewers use the existing review routes."
              />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {recent_audit_activity.map((row) => (
                  <li key={row.id} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                            row.status === "approved"
                              ? "bg-emerald-100 text-emerald-950 ring-emerald-200/80"
                              : "bg-amber-100 text-amber-950 ring-amber-200/80"
                          }`}
                        >
                          {activityStatusLabel(row.status)}
                        </span>
                        <span className="text-xs text-slate-500">{formatDateTime(row.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        Report{" "}
                        <Link href={`${base}/audit/${row.report_id}`} className="font-medium text-sky-700 hover:underline">
                          {formatShortId(row.report_id)}
                        </Link>
                        {" · "}
                        <Link href={`${base}/cases/${row.case_id}`} className="text-sky-700 hover:underline">
                          Case {formatShortId(row.case_id)}
                        </Link>
                      </p>
                      {row.note ? <p className="mt-1 text-xs text-slate-600 line-clamp-2">{row.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Report pipeline status"
            description="fi_model_runs job counts and total fi_scorecards rows for this tenant (read-only health)."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FiKpiTile label="Runs queued" value={String(pipeline.model_runs.queued)} tone={pipelineBusy ? "info" : "neutral"} />
              <FiKpiTile
                label="Runs running"
                value={String(pipeline.model_runs.running)}
                tone={pipeline.model_runs.running > 0 ? "info" : "neutral"}
              />
              <FiKpiTile
                label="Runs failed"
                value={String(pipeline.model_runs.failed)}
                tone={pipelineHasFailures ? "danger" : "neutral"}
              />
              <FiKpiTile label="Runs complete" value={String(pipeline.model_runs.complete)} tone="success" />
            </div>
            <p className="mt-4 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{pipeline.scorecards_total}</span> scorecard
              {pipeline.scorecards_total === 1 ? "" : "s"} recorded for this tenant (fi_scorecards).
            </p>
          </SectionCard>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <FiCard>
            <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
            <p className="mt-1 text-sm text-slate-600">Shortcuts use existing FI OS routes only.</p>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <FiQuickActionCard
                title="Open SurgeryOS"
                description="Case worklist, planning, procedures, and readiness."
                href={`${base}/cases`}
                icon={<ClipboardList className="h-5 w-5" aria-hidden />}
                showOpenAffordance={false}
                className="!min-h-0 sm:!min-h-0"
              />
              <FiQuickActionCard
                title="Open PatientOS"
                description="Patient directory and profiles."
                href={`${base}/patients`}
                icon={<Users className="h-5 w-5" aria-hidden />}
                showOpenAffordance={false}
                className="!min-h-0 sm:!min-h-0"
              />
              <FiQuickActionCard
                title="Review queue"
                description="Jump to the audit queue table on this page."
                href={`${base}/audit#audit-queue`}
                icon={<ListChecks className="h-5 w-5" aria-hidden />}
                showOpenAffordance={false}
                className="!min-h-0 sm:!min-h-0"
              />
            </div>
          </FiCard>
        </div>
      </div>
    </div>
  );
}
