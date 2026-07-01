"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { refreshWorkforcePlanningAction } from "@/src/lib/actions/workforce-phase-2-sprint-5-actions";
import { formatCentsAsCurrency } from "@/src/lib/workforce/wageProfileCore";
import type { WorkforcePlanningSnapshot } from "@/src/lib/workforce/workforcePlanningEngineCore";

const PRIORITY_STYLES = {
  critical: "border-red-500/40 bg-red-500/10 text-red-100",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  medium: "border-sky-500/40 bg-sky-500/10 text-sky-100",
  low: "border-white/20 bg-white/5 text-[#CBD5E1]",
};

export function WorkforceOsPlanningClient({
  tenantId,
  planning,
  canManage,
}: {
  tenantId: string;
  planning: WorkforcePlanningSnapshot;
  canManage: boolean;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topAction = planning.nextBestActions[0] ?? null;

  function onRefresh() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await refreshWorkforcePlanningAction(tenantId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Planning signals refreshed for the next 7 days.");
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
          <h1 className="mt-2 text-2xl font-semibold text-[#F8FAFC]">Workforce planning engine</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">
            Staffing shortage prediction, credential expiry risk, recruitment forecast, procedure
            capacity, and next-best workforce actions.
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Horizon {planning.horizonStart} → {planning.horizonEnd} · Updated{" "}
            {new Date(planning.generatedAt).toLocaleString()}
          </p>
        </div>
        {canManage ? (
          <Button size="sm" disabled={pending} onClick={onRefresh}>
            Refresh planning signals
          </Button>
        ) : null}
      </header>

      {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {topAction ? (
        <DashboardCard className="border-[#22C1FF]/30 bg-[#22C1FF]/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#22C1FF]">
            Next best workforce action
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#F8FAFC]">{topAction.title}</h2>
          <p className="mt-2 text-sm text-[#CBD5E1]">{topAction.description}</p>
          {topAction.href ? (
            <Link
              href={topAction.href}
              className="mt-4 inline-block rounded-lg bg-[#22C1FF]/20 px-4 py-2 text-sm font-medium text-[#22C1FF] hover:bg-[#22C1FF]/30"
            >
              Take action →
            </Link>
          ) : null}
        </DashboardCard>
      ) : null}

      <DashboardCard className="p-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-5">
          <div>
            <dt className="text-[#64748B]">Procedure capacity</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
              {planning.procedureCapacity.capacityUtilizationPercent}%
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Credential risks</dt>
            <dd className="mt-1 text-xl font-semibold text-amber-100">
              {planning.credentialRisks.length}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Role shortages</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
              {planning.staffingShortages.length}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Recruitment hires needed</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
              {planning.recruitmentForecast.recommendedHires}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">7-day wage exposure</dt>
            <dd className="mt-1 text-xl font-semibold text-[#22C1FF]">
              {formatCentsAsCurrency(planning.weeklyWageExposureCents)}
            </dd>
          </div>
        </dl>
      </DashboardCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Procedure capacity forecast</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#64748B]">Scheduled</dt>
              <dd className="mt-1 text-[#E2E8F0]">
                {planning.procedureCapacity.scheduledProcedures}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Fully staffed</dt>
              <dd className="mt-1 text-emerald-200">
                {planning.procedureCapacity.fullyStaffedProcedures}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Understaffed</dt>
              <dd className="mt-1 text-amber-100">
                {planning.procedureCapacity.understaffedProcedures}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Est. max capacity</dt>
              <dd className="mt-1 text-[#E2E8F0]">
                {planning.procedureCapacity.estimatedMaxProcedures}
              </dd>
            </div>
          </dl>
        </DashboardCard>

        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Recruitment need forecast</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#64748B]">Active pipeline</dt>
              <dd className="mt-1 text-[#E2E8F0]">
                {planning.recruitmentForecast.activePipelineCount}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Late-stage candidates</dt>
              <dd className="mt-1 text-[#E2E8F0]">
                {planning.recruitmentForecast.lateStageCount}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Pipeline coverage</dt>
              <dd className="mt-1 text-[#E2E8F0]">
                {planning.recruitmentForecast.pipelineCoveragePercent}%
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Open role definitions</dt>
              <dd className="mt-1 text-[#E2E8F0]">
                {planning.recruitmentForecast.openRoleRequirementCount}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-[#94A3B8]">{planning.recruitmentForecast.reason}</p>
        </DashboardCard>
      </div>

      <DashboardCard className="p-6">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">Next best actions</h2>
        <ul className="mt-4 space-y-3">
          {planning.nextBestActions.length === 0 ? (
            <li className="text-sm text-[#94A3B8]">No actions required — workforce signals are healthy.</li>
          ) : (
            planning.nextBestActions.map((action) => (
              <li
                key={action.id}
                className={`rounded-lg border px-4 py-3 ${PRIORITY_STYLES[action.priority]}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium capitalize">{action.title}</p>
                    <p className="mt-1 text-xs opacity-90">{action.description}</p>
                  </div>
                  {action.href ? (
                    <Link href={action.href} className="text-xs underline-offset-2 hover:underline">
                      Open →
                    </Link>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </DashboardCard>

      <DashboardCard className="overflow-x-auto p-0">
        <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-[#F8FAFC]">
          Staffing shortage predictions
        </h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Shortage</th>
              <th className="px-4 py-3">Affected dates</th>
              <th className="px-4 py-3">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {planning.staffingShortages.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#94A3B8]">
                  No role shortages predicted in the planning horizon.
                </td>
              </tr>
            ) : (
              planning.staffingShortages.map((row) => (
                <tr key={row.role} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3 capitalize text-[#F8FAFC]">
                    {row.role.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{row.shortageCount}</td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {row.affectedDates.slice(0, 3).join(", ")}
                    {row.affectedDates.length > 3 ? ` +${row.affectedDates.length - 3}` : ""}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{row.confidence}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DashboardCard>

      <DashboardCard className="overflow-x-auto p-0">
        <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-[#F8FAFC]">
          Credential expiry risk
        </h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Days</th>
              <th className="px-4 py-3">Severity</th>
            </tr>
          </thead>
          <tbody>
            {planning.credentialRisks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#94A3B8]">
                  No credential or certification expiry risks in the next 30 days.
                </td>
              </tr>
            ) : (
              planning.credentialRisks.slice(0, 20).map((risk, idx) => (
                <tr key={`${risk.staffMemberId}-${idx}`} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3 text-[#F8FAFC]">{risk.staffName}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">
                    {risk.displayName}
                    <span className="ml-1 text-xs text-[#64748B]">({risk.itemType})</span>
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{risk.expiresAt}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{risk.daysUntilExpiry}</td>
                  <td className="px-4 py-3 capitalize text-[#94A3B8]">{risk.severity}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DashboardCard>

      <p className="text-center text-sm text-[#64748B]">
        <Link href={`${base}/procedure-staffing`} className="hover:underline">
          Procedure staffing
        </Link>
        {" · "}
        <Link href={`${base}/recruitment`} className="hover:underline">
          Recruitment
        </Link>
        {" · "}
        <Link href={`${base}/shift-cost`} className="hover:underline">
          Shift cost intelligence
        </Link>
      </p>
    </div>
  );
}