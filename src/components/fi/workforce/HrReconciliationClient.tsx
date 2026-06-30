"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { approveStaffHrLinkAction } from "@/lib/actions/workforce-os-staff-lifecycle-actions";
import type { HrReconciliationSuggestion } from "@/src/lib/workforce-os/staffLifecycleTypes";

export function HrReconciliationClient({
  tenantId,
  initialSuggestions,
}: {
  tenantId: string;
  initialSuggestions: HrReconciliationSuggestion[];
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const unlinkedCount = useMemo(
    () => suggestions.filter((s) => s.matchType === "none" || !s.suggestedIiohrRecord).length,
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
          never auto-linked.
        </p>
      </header>

      <DashboardCard className="p-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[#64748B]">Suggestions</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{suggestions.length}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Exact email matches</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
              {suggestions.filter((s) => s.matchType === "exact_email").length}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Unlinked / no match</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{unlinkedCount}</dd>
          </div>
        </dl>
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
                  No reconciliation suggestions — all staff are linked or have no match.
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
    </div>
  );
}
