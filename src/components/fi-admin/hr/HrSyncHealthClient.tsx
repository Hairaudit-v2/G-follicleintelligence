"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Activity, AlertTriangle, CheckCircle2, Download, RefreshCw, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import {
  previewHrStaffFeedAction,
  relinkHrStaffByEmailAction,
  relinkHrStaffBySourceStaffIdAction,
  runHrStaffSyncNowAction,
} from "@/src/lib/actions/fi-hr-sync-health-actions";
import {
  buildHrSyncIssuesCsvExport,
  HR_STAFF_SYNC_ISSUE_LABELS,
  type HrStaffSyncIssueKind,
} from "@/src/lib/hr/hrStaffSyncHealthDashboard";
import type { HrSyncHealthPageModel } from "@/src/lib/hr/hrStaffSyncHealthPage.server";

function formatIso(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function healthBorder(variant: HrSyncHealthPageModel["overview"]["variant"]): string {
  switch (variant) {
    case "healthy":
      return "border-emerald-500/40";
    case "warning":
      return "border-amber-500/40";
    default:
      return "border-red-500/40";
  }
}

function healthIcon(variant: HrSyncHealthPageModel["overview"]["variant"]) {
  switch (variant) {
    case "healthy":
      return <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden />;
    default:
      return <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden />;
  }
}

function issueLabel(kind: HrStaffSyncIssueKind): string {
  return HR_STAFF_SYNC_ISSUE_LABELS[kind];
}

export function HrSyncHealthClient({ tenantId, pageModel }: { tenantId: string; pageModel: HrSyncHealthPageModel }) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}`;
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [feedPreview, setFeedPreview] = useState<Awaited<ReturnType<typeof previewHrStaffFeedAction>> | null>(null);
  const [pending, startTransition] = useTransition();

  const { overview, latestRun, latestSuccessfulRun, envChecklist, staffIssues } = pageModel;

  const exportCsv = useCallback(() => {
    const csv = buildHrSyncIssuesCsvExport(staffIssues);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hr-sync-issues.csv";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [staffIssues]);

  const runAction = useCallback(
    (fn: () => Promise<{ ok: boolean; error?: string; message?: string; summaryMessage?: string }>) => {
      setError(null);
      setActionMessage(null);
      startTransition(async () => {
        const r = await fn();
        if (!r.ok) {
          setError(r.error ?? "Action failed.");
          return;
        }
        setActionMessage(r.message ?? r.summaryMessage ?? "Done.");
        router.refresh();
      });
    },
    [router]
  );

  const feedSampleJson = useMemo(() => {
    if (!feedPreview || !feedPreview.ok) return null;
    return JSON.stringify(feedPreview.sample, null, 2);
  }, [feedPreview]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">HR</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">HR sync health</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Monitor IIOHR HR staff sync runs, staff-level HR link issues, and environment readiness. Operational metadata
          only — no payroll or sensitive HR fields are shown or exported.
        </p>
        <p className="text-sm text-[#94A3B8]">
          <Link href={`${base}/hr/staff-import`} className="text-[#22C1FF] hover:underline">
            ← Staff import
          </Link>
          <span className="mx-2 text-[#475569]">·</span>
          <Link href={`${base}/staff`} className="text-[#22C1FF] hover:underline">
            Staff directory
          </Link>
          <span className="mx-2 text-[#475569]">·</span>
          <Link href={`${base}/staff/role-review`} className="text-[#22C1FF] hover:underline">
            Role review
          </Link>
          <span className="mx-2 text-[#475569]">·</span>
          <Link href={`${base}/hr/staff-readiness`} className="text-[#22C1FF] hover:underline">
            Staff readiness
          </Link>
        </p>
      </header>

      {error ? (
        <InfoNotice variant="danger" title="Action failed">
          {error}
        </InfoNotice>
      ) : null}
      {actionMessage ? (
        <InfoNotice variant="success" title="Success">
          {actionMessage}
        </InfoNotice>
      ) : null}

      <DashboardCard className={`p-5 ${healthBorder(overview.variant)}`}>
        <div className="flex flex-wrap items-start gap-3">
          {healthIcon(overview.variant)}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Sync health</h2>
            <p className="mt-1 text-sm font-medium text-[#E2E8F0]">{overview.title}</p>
            <p className="mt-1 text-sm text-[#94A3B8]">{overview.message}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[#64748B]">Last successful sync</dt>
                <dd className="mt-0.5 text-sm font-medium text-[#E2E8F0]">{formatIso(overview.lastSuccessfulSyncAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[#64748B]">Last attempted sync</dt>
                <dd className="mt-0.5 text-sm font-medium text-[#E2E8F0]">{formatIso(overview.lastAttemptedSyncAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[#64748B]">Staff with issues</dt>
                <dd className="mt-0.5 text-sm font-medium text-[#E2E8F0]">{overview.staffWithIssuesCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[#64748B]">Stale staff metadata (&gt;14d)</dt>
                <dd
                  className={`mt-0.5 text-sm font-medium ${overview.staffMetadataStale ? "text-amber-300" : "text-emerald-300"}`}
                >
                  {overview.staleStaffCount}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </DashboardCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#F8FAFC]">
            <Activity className="h-4 w-4 text-[#22C1FF]" aria-hidden />
            Latest run
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <StatCard label="Status" value={latestRun.status ?? "—"} />
            <StatCard label="Mode" value={latestRun.mode ?? "—"} />
            <StatCard label="Rows received" value={latestRun.receivedRows} />
            <StatCard label="Rows updated" value={latestRun.updatedCount} />
            <StatCard label="Rows skipped" value={latestRun.skippedCount} />
            <StatCard label="Warnings" value={latestRun.warningCount} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#64748B]">Started</dt>
              <dd className="text-[#E2E8F0]">{formatIso(latestRun.startedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#64748B]">Finished</dt>
              <dd className="text-[#E2E8F0]">{formatIso(latestRun.finishedAt)}</dd>
            </div>
            {latestRun.trigger ? (
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Trigger</dt>
                <dd className="font-mono text-xs text-[#CBD5E1]">{latestRun.trigger}</dd>
              </div>
            ) : null}
          </dl>
          {latestRun.errorMessage ? (
            <InfoNotice variant="danger" title="Latest run error" className="mt-4">
              {latestRun.errorMessage}
            </InfoNotice>
          ) : null}
          {latestSuccessfulRun.runId && latestSuccessfulRun.runId !== latestRun.runId ? (
            <p className="mt-3 text-xs text-[#64748B]">
              Last success: {formatIso(latestSuccessfulRun.finishedAt ?? latestSuccessfulRun.startedAt)} (
              {latestSuccessfulRun.updatedCount} updated)
            </p>
          ) : null}
        </DashboardCard>

        <DashboardCard className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#F8FAFC]">
            <Wrench className="h-4 w-4 text-[#22C1FF]" aria-hidden />
            Admin actions
          </h2>
          <p className="mt-2 text-xs text-[#64748B]">
            Tenant admins and platform operators only. Stale warnings clear automatically after a successful sync
            refreshes staff metadata.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => runAction(() => runHrStaffSyncNowAction({ tenantId }))}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Run sync now
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await previewHrStaffFeedAction({ tenantId });
                  if (!r.ok) {
                    setError(r.error);
                    setFeedPreview(null);
                    return;
                  }
                  setFeedPreview(r);
                });
              }}
            >
              Preview latest HR feed
            </Button>
            <Button type="button" variant="outline" disabled={pending || staffIssues.length === 0} onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Export issue CSV
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => runAction(() => relinkHrStaffByEmailAction({ tenantId }))}
            >
              Re-link staff by email
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => runAction(() => relinkHrStaffBySourceStaffIdAction({ tenantId }))}
            >
              Re-link by source_staff_id
            </Button>
          </div>
          {feedPreview?.ok ? (
            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-medium text-[#94A3B8]">
                Feed preview — {feedPreview.feedRowCount} row{feedPreview.feedRowCount === 1 ? "" : "s"} (sample below)
              </p>
              <pre className="mt-2 max-h-48 overflow-auto text-[11px] text-[#CBD5E1]">{feedSampleJson}</pre>
            </div>
          ) : null}
          {pageModel.isEvolvedPerthCronTenant ? (
            <p className="mt-3 text-xs text-[#64748B]">
              Scheduled cron: <span className="font-mono text-[#94A3B8]">{pageModel.automationCronPath}</span>
            </p>
          ) : null}
        </DashboardCard>
      </div>

      <DashboardCard className="p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Staff issues</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Active staff with HR link, onboarding, URL, or readiness metadata gaps. Amber rows need attention.
        </p>
        {staffIssues.length === 0 ? (
          <p className="mt-4 text-sm text-emerald-300">No staff HR sync issues detected.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-[#64748B]">
                  <th className="px-2 py-2 font-medium">Staff</th>
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody>
                {staffIssues.map((row) => (
                  <tr key={row.staffId} className="border-b border-white/5 text-[#E2E8F0]">
                    <td className="px-2 py-2">{row.fullName}</td>
                    <td className="px-2 py-2 font-mono text-xs text-[#94A3B8]">{row.email ?? "—"}</td>
                    <td className="px-2 py-2">
                      <ul className="flex flex-wrap gap-1">
                        {row.issues.map((issue) => (
                          <li
                            key={issue}
                            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
                          >
                            {issueLabel(issue)}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      <DashboardCard className="p-5">
        <h2 className="text-base font-semibold text-[#F8FAFC]">Environment checklist</h2>
        <p className="mt-1 text-sm text-[#94A3B8]">Present/missing only — secret values are never displayed.</p>
        <ul className="mt-4 space-y-2">
          {envChecklist.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 px-3 py-2">
              <span className="text-sm text-[#E2E8F0]">
                <span className="font-mono text-xs text-[#94A3B8]">{item.key}</span>
                {item.optional ? <span className="ml-2 text-xs text-[#64748B]">(optional)</span> : null}
              </span>
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${item.present ? "text-emerald-400" : item.optional ? "text-[#64748B]" : "text-amber-400"}`}
              >
                {item.present ? "Present" : item.optional ? "Not set" : "Missing"}
              </span>
            </li>
          ))}
        </ul>
      </DashboardCard>
    </div>
  );
}
