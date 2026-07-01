"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { approveStaffHrLinkAction } from "@/lib/actions/workforce-os-staff-lifecycle-actions";
import type {
  HrReconciliationArchivedRecord,
  HrReconciliationMetrics,
  HrReconciliationSuggestion,
} from "@/src/lib/workforce-os/staffLifecycleTypes";

export function HrReconciliationClient({
  tenantId,
  initialMetrics,
  initialSuggestions,
  initialArchivedHistorical,
}: {
  tenantId: string;
  initialMetrics: HrReconciliationMetrics;
  initialSuggestions: HrReconciliationSuggestion[];
  initialArchivedHistorical: HrReconciliationArchivedRecord[];
}) {
  const [metrics] = useState(initialMetrics);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

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
            {suggestions.length === 0 ? (
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
