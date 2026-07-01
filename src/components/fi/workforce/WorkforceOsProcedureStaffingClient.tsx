"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { applyRecommendedProcedureTeamAction } from "@/src/lib/actions/workforce-phase-2-sprint-4-actions";
import { formatCentsAsCurrency } from "@/src/lib/workforce/wageProfileCore";
import type { ProcedureStaffingOptimizerSnapshot } from "@/src/lib/workforce/procedureStaffingOptimizerCore";

export function WorkforceOsProcedureStaffingClient({
  tenantId,
  optimizer,
  workDate,
  canManage,
}: {
  tenantId: string;
  optimizer: ProcedureStaffingOptimizerSnapshot;
  workDate: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const [date, setDate] = useState(workDate);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onDateChange(next: string) {
    setDate(next);
    router.push(`${base}/procedure-staffing?date=${encodeURIComponent(next)}`);
  }

  function onApplyTeam(surgeryId: string) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await applyRecommendedProcedureTeamAction(tenantId, surgeryId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        `Applied ${res.assignedCount} staff assignment(s). Skipped ${res.skippedCount} ineligible or failed.`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">
            WorkforceOS · Phase 2
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#F8FAFC]">
            Procedure staffing optimizer
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">
            Recommended surgery teams with skill, credential, availability matching, cost-aware
            selection, and automatic blocking of ineligible staff.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-[#94A3B8]">
            Procedure date
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="ml-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[#F8FAFC]"
            />
          </label>
          <Link
            href={`${base}/shift-cost?date=${encodeURIComponent(date)}`}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5"
          >
            Shift cost intelligence
          </Link>
        </div>
      </header>

      <DashboardCard className="p-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[#64748B]">Procedures</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
              {optimizer.procedureCount}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Fully staffed (recommended)</dt>
            <dd className="mt-1 text-xl font-semibold text-emerald-200">
              {optimizer.completeCount}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Blocked candidates</dt>
            <dd className="mt-1 text-xl font-semibold text-amber-100">
              {optimizer.blockedStaffCount}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Total recommended labour</dt>
            <dd className="mt-1 text-xl font-semibold text-[#22C1FF]">
              {formatCentsAsCurrency(optimizer.totalRecommendedCostCents)}
            </dd>
          </div>
        </dl>
      </DashboardCard>

      {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {optimizer.recommendations.length === 0 ? (
        <DashboardCard className="p-8 text-center text-sm text-[#94A3B8]">
          No procedures scheduled for this date.
        </DashboardCard>
      ) : (
        optimizer.recommendations.map((rec) => (
          <DashboardCard key={rec.surgeryId} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#F8FAFC]">{rec.procedureLabel}</h2>
                <p className="mt-1 text-xs text-[#64748B]">
                  {rec.scheduledDate} · {rec.eventType} ·{" "}
                  {rec.staffingComplete ? (
                    <span className="text-emerald-200">Staffing complete</span>
                  ) : (
                    <span className="text-amber-100">
                      Missing roles:{" "}
                      {rec.missingRoles.map((m) => `${m.role} (${m.assigned}/${m.required})`).join(", ")}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#94A3B8]">Recommended team cost</p>
                <p className="text-lg font-semibold text-[#22C1FF]">
                  {formatCentsAsCurrency(rec.totalTeamCostCents)}
                </p>
                {canManage && rec.recommendedTeam.length > 0 ? (
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={pending}
                    onClick={() => onApplyTeam(rec.surgeryId)}
                  >
                    Apply recommended team
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Staff</th>
                    <th className="py-2 pr-4">Readiness</th>
                    <th className="py-2 pr-4">Cost</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rec.recommendedTeam.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-[#94A3B8]">
                        No eligible recommendations — check blocked staff below.
                      </td>
                    </tr>
                  ) : (
                    rec.recommendedTeam.map((member) => (
                      <tr key={`${member.staffId}-${member.assignedRole}`} className="border-t border-white/[0.06]">
                        <td className="py-2 pr-4 capitalize text-[#CBD5E1]">
                          {member.assignedRole.replace(/_/g, " ")}
                        </td>
                        <td className="py-2 pr-4 text-[#F8FAFC]">{member.name}</td>
                        <td className="py-2 pr-4 text-[#CBD5E1]">
                          {member.readinessScore} ({member.readinessBand})
                        </td>
                        <td className="py-2 pr-4 text-[#E2E8F0]">
                          {formatCentsAsCurrency(member.grossCostCents)}
                        </td>
                        <td className="py-2 pr-4 capitalize text-emerald-200">{member.section}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {rec.blockedStaff.length > 0 ? (
              <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-100">
                  Auto-blocked ({rec.blockedStaff.length})
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-50/90">
                  {rec.blockedStaff.slice(0, 8).map((b, idx) => (
                    <li key={`${b.staffId}-${idx}`}>
                      {b.name} ({b.assignedRole}) — {b.reasons[0] ?? "Ineligible"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </DashboardCard>
        ))
      )}
    </div>
  );
}