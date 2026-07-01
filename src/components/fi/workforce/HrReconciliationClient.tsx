"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { approveStaffHrLinkAction } from "@/lib/actions/workforce-os-staff-lifecycle-actions";
import type {
  HrReconciliationArchivedRecord,
  HrReconciliationDiagnostics,
  HrReconciliationMetrics,
  HrReconciliationSuggestion,
} from "@/src/lib/workforce-os/staffLifecycleTypes";

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString();
}

function EnvFlag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-[#94A3B8]">{label}</span>
      <span className={ok ? "text-emerald-300" : "text-amber-300"}>{ok ? "OK" : "Missing"}</span>
    </div>
  );
}

export function HrReconciliationClient({
  tenantId,
  initialMetrics,
  initialSuggestions,
  initialArchivedHistorical,
  initialDiagnostics,
}: {
  tenantId: string;
  initialMetrics: HrReconciliationMetrics;
  initialSuggestions: HrReconciliationSuggestion[];
  initialArchivedHistorical: HrReconciliationArchivedRecord[];
  initialDiagnostics: HrReconciliationDiagnostics;
}) {
  const [metrics] = useState(initialMetrics);
  const [diagnostics] = useState(initialDiagnostics);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  const feedBlocked = diagnostics.feedStatus !== "ok";

  const actionableCount = useMemo(
    () =>
      suggestions.filter(
        (s) => s.matchType === "exact_email" || s.matchType === "name_suggestion"
      ).length,
    [suggestions]
  );

  const noMatchCount = useMemo(
    () => suggestions.filter((s) => s.matchType === "none").length,
    [suggestions]
  );

  const sourceSystemSummary = useMemo(
    () =>
      Object.entries(diagnostics.fiStaffSourceSystemCounts)
        .map(([key, count]) => `${key}: ${count}`)
        .join(" · ") || "—",
    [diagnostics.fiStaffSourceSystemCounts]
  );

  function onApprove(row: HrReconciliationSuggestion) {
    const match = row.suggestedIiohrRecord;
    if (!match || !row.canAutoApprove) return;
    setMessage(null);
    startTransition(async () => {
      const res = await approveStaffHrLinkAction(tenantId, row.staffMemberId, match.id);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setSuggestions((prev) => prev.filter((s) => s.staffMemberId !== row.staffMemberId));
      setMessage(`Linked ${row.fiOsStaffName} to IIOHR record.`);
    });
  }

  function onReject(row: HrReconciliationSuggestion) {
    setSuggestions((prev) => prev.filter((s) => s.staffMemberId !== row.staffMemberId));
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">
          HR Reconciliation
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#F8FAFC]">Link existing staff to IIOHR</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">
          Exact email matches can be approved manually. Name suggestions require explicit approval —
          never auto-linked. Archived and already-linked staff are excluded from the action queue.
        </p>
      </header>

      {feedBlocked && diagnostics.feedBlockedMessage ? (
        <DashboardCard className="border-amber-500/40 bg-amber-500/10 p-4">
          <h2 className="text-sm font-semibold text-amber-100">IIOHR feed unavailable</h2>
          <p className="mt-2 text-sm text-amber-50/90">{diagnostics.feedBlockedMessage}</p>
          <p className="mt-3 text-xs text-amber-100/80">
            Reconciliation actions are hidden until IIOHR candidate rows are available — this prevents
            false &quot;No match&quot; results when the feed is empty or misconfigured.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/fi-admin/${tenantId}/hr/sync-health`}
              className="text-xs text-amber-100 underline-offset-2 hover:underline"
            >
              Open HR sync health
            </Link>
            <Link
              href={`/fi-admin/${tenantId}/hr/staff-import`}
              className="text-xs text-amber-100 underline-offset-2 hover:underline"
            >
              Run staff import / sync
            </Link>
          </div>
        </DashboardCard>
      ) : null}

      <DashboardCard className="p-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[#64748B]">Active staff</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{metrics.activeStaff}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Already linked</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{metrics.alreadyLinked}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Needs reconciliation</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
              {metrics.needsReconciliation}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Archived excluded</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{metrics.archivedExcluded}</dd>
          </div>
        </dl>
      </DashboardCard>

      <DashboardCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#F8FAFC]">Runtime diagnostics</h2>
          <Button size="sm" variant="outline" onClick={() => setShowDiagnostics((prev) => !prev)}>
            {showDiagnostics ? "Hide" : "Show"}
          </Button>
        </div>
        {showDiagnostics ? (
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-[#64748B]">FI staff rows</dt>
              <dd className="mt-1 font-semibold text-[#F8FAFC]">{diagnostics.fiStaffCount}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">IIOHR feed rows (raw)</dt>
              <dd className="mt-1 font-semibold text-[#F8FAFC]">{diagnostics.iiohrRawFeedRowCount}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">IIOHR candidates (UUID)</dt>
              <dd className="mt-1 font-semibold text-[#F8FAFC]">{diagnostics.iiohrCandidateCount}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Exact email pairs</dt>
              <dd className="mt-1 font-semibold text-[#F8FAFC]">
                {diagnostics.exactNormalizedEmailMatchCount}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Staff identity links</dt>
              <dd className="mt-1 font-semibold text-[#F8FAFC]">
                {diagnostics.staffIdentityLinksCount}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Last IIOHR sync success</dt>
              <dd className="mt-1 font-semibold text-[#F8FAFC]">
                {formatTimestamp(diagnostics.lastSuccessfulIiohrSyncAt)}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-[#64748B]">FI source_system counts</dt>
              <dd className="mt-1 text-[#CBD5E1]">{sourceSystemSummary}</dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-[#64748B]">Feed status</dt>
              <dd className="mt-1 capitalize text-[#CBD5E1]">
                {diagnostics.feedStatus.replace(/_/g, " ")}
                {diagnostics.feedUrlSource ? ` · env ${diagnostics.feedUrlSource}` : ""}
                {diagnostics.iiohrCandidatesSkippedNonUuid > 0
                  ? ` · ${diagnostics.iiohrCandidatesSkippedNonUuid} feed rows skipped (non-UUID id)`
                  : ""}
              </dd>
            </div>
          </dl>
        ) : null}
        {showDiagnostics ? (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Env checks</p>
            <EnvFlag label="IIOHR feed URL" ok={diagnostics.feedUrlConfigured} />
            <EnvFlag label="IIOHR feed key (optional)" ok={diagnostics.feedKeyConfigured} />
            <EnvFlag label="CRON_SECRET" ok={diagnostics.cronSecretConfigured} />
            <EnvFlag label="EVOLVED_PERTH_TENANT_ID" ok={diagnostics.evolvedPerthTenantIdConfigured} />
            {diagnostics.legacyFeedUrlConfigured ? (
              <p className="text-xs text-amber-200/90">
                Legacy IIOHR_HR_STAFF_FEED_URL is set — prefer IIOHR_HR_PERTH_STAFF_FEED_URL in production.
              </p>
            ) : null}
          </div>
        ) : null}
      </DashboardCard>

      <DashboardCard className="p-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[#64748B]">Action queue</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{suggestions.length}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Exact email matches</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
              {suggestions.filter((s) => s.matchType === "exact_email").length}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Active unlinked (no IIOHR match)</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{noMatchCount}</dd>
          </div>
        </dl>
        {actionableCount > 0 ? (
          <p className="mt-3 text-xs text-[#64748B]">
            {actionableCount} staff with suggested IIOHR matches awaiting review.
          </p>
        ) : null}
      </DashboardCard>

      {message ? <p className="text-sm text-emerald-200">{message}</p> : null}

      <DashboardCard className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">FI OS staff</th>
              <th className="px-4 py-3">Suggested IIOHR match</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Match type</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {feedBlocked ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#94A3B8]">
                  Action queue hidden — load the IIOHR staff feed before reconciling.
                </td>
              </tr>
            ) : suggestions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#94A3B8]">
                  No reconciliation actions — all active staff are linked or excluded.
                </td>
              </tr>
            ) : (
              suggestions.map((row) => (
                <tr key={row.staffMemberId} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#F8FAFC]">{row.fiOsStaffName}</p>
                    <p className="text-xs text-[#64748B]">{row.fiOsEmail ?? "No email"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {row.suggestedIiohrRecord ? (
                      <>
                        <p className="text-[#E2E8F0]">{row.suggestedIiohrRecord.full_name ?? "—"}</p>
                        <p className="text-xs text-[#64748B]">
                          {row.suggestedIiohrRecord.email ?? "No email"}
                        </p>
                      </>
                    ) : (
                      <span className="text-[#64748B]">No match</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{row.confidenceScore}%</td>
                  <td className="px-4 py-3 capitalize text-[#CBD5E1]">
                    {row.matchType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.canAutoApprove ? (
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() => onApprove(row)}
                        >
                          Approve link
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => onReject(row)}>
                        Reject
                      </Button>
                      {row.fiStaffId ? (
                        <Link
                          href={`/fi-admin/${tenantId}/workforce-os/staff/${row.fiStaffId}`}
                          className="text-xs text-[#22C1FF] underline-offset-2 hover:underline"
                        >
                          Profile
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DashboardCard>

      {initialArchivedHistorical.length > 0 ? (
        <DashboardCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#F8FAFC]">Archived / historical records</h2>
              <p className="mt-1 text-xs text-[#64748B]">
                {initialArchivedHistorical.length} archived staff excluded from reconciliation
                totals. These records are informational only — no action required.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowArchived((prev) => !prev)}
            >
              {showArchived ? "Hide" : "Show"} archived
            </Button>
          </div>
          {showArchived ? (
            <ul className="mt-4 space-y-2 text-sm">
              {initialArchivedHistorical.map((row) => (
                <li
                  key={row.staffMemberId}
                  className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] py-2 text-[#94A3B8]"
                >
                  <span className="text-[#CBD5E1]">{row.fiOsStaffName}</span>
                  <span>{row.fiOsEmail ?? "No email"}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </DashboardCard>
      ) : null}
    </div>
  );
}
