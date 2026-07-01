"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import { formatCentsAsCurrency } from "@/src/lib/workforce/wageProfileCore";
import {
  formatCostPerHour,
  type ShiftCostIntelligenceSnapshot,
} from "@/src/lib/workforce/shiftCostIntelligenceCore";

export function WorkforceOsShiftCostClient({
  tenantId,
  intelligence,
  canManage,
}: {
  tenantId: string;
  intelligence: ShiftCostIntelligenceSnapshot;
  canManage: boolean;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const [workDate, setWorkDate] = useState(intelligence.workDate);

  function onDateChange(next: string) {
    setWorkDate(next);
    router.push(`${base}/shift-cost?date=${encodeURIComponent(next)}`);
  }

  const { dailyRoster, surgeryTeam, procedures, efficiency, weeklyForecast } = intelligence;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">
            WorkforceOS · Phase 2
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#F8FAFC]">Shift cost intelligence</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">
            Daily roster cost, surgery team labour, cost per procedure, efficiency metrics, and
            weekly wage exposure forecast.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-[#94A3B8]">
            Analysis date
            <input
              type="date"
              value={workDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="ml-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[#F8FAFC]"
            />
          </label>
          <Link
            href={base}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5"
          >
            Staff directory
          </Link>
          {canManage ? (
            <Link
              href={`${base}/payroll`}
              className="rounded-lg border border-[#22C1FF]/30 bg-[#22C1FF]/10 px-4 py-2 text-sm font-medium text-[#22C1FF] hover:bg-[#22C1FF]/15"
            >
              Payroll & wages
            </Link>
          ) : null}
        </div>
      </header>

      <DashboardCard className="p-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-5">
          <div>
            <dt className="text-[#64748B]">Daily roster cost</dt>
            <dd className="mt-1 text-xl font-semibold text-[#22C1FF]">
              {formatCentsAsCurrency(dailyRoster.totalGrossCostCents)}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Surgery team cost</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
              {formatCentsAsCurrency(surgeryTeam.totalGrossCostCents)}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Procedures today</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{procedures.length}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Efficiency index</dt>
            <dd className="mt-1 text-xl font-semibold text-emerald-200">
              {efficiency.labourEfficiencyIndex}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">7-day wage exposure</dt>
            <dd className="mt-1 text-xl font-semibold text-amber-100">
              {formatCentsAsCurrency(weeklyForecast.totalForecastGrossCostCents)}
            </dd>
          </div>
        </dl>
      </DashboardCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Labour efficiency</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#64748B]">Profile coverage</dt>
              <dd className="mt-1 text-[#E2E8F0]">{efficiency.profileCoveragePercent}%</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Cost per scheduled hour</dt>
              <dd className="mt-1 text-[#E2E8F0]">
                {formatCostPerHour(efficiency.costPerScheduledHourCents)}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Avg cost per shift</dt>
              <dd className="mt-1 text-[#E2E8F0]">
                {formatCentsAsCurrency(efficiency.averageCostPerShiftCents)}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Missing wage profiles</dt>
              <dd className="mt-1 text-amber-100">{efficiency.missingProfileCount}</dd>
            </div>
          </dl>
        </DashboardCard>

        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Weekly wage exposure forecast</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            {weeklyForecast.weekStart} → {weeklyForecast.weekEnd} · avg{" "}
            {formatCentsAsCurrency(weeklyForecast.averageDailyCostCents)}/day
          </p>
          <ul className="mt-4 divide-y divide-white/10 text-sm">
            {weeklyForecast.days.map((day) => (
              <li key={day.workDate} className="flex justify-between gap-2 py-2">
                <span className="text-[#CBD5E1]">
                  {day.workDate}
                  <span className="ml-2 text-xs text-[#64748B]">
                    {day.shiftCount} shifts · {Math.round(day.totalScheduledMinutes / 60)}h
                  </span>
                </span>
                <span className="text-[#E2E8F0]">
                  {formatCentsAsCurrency(day.forecastGrossCostCents)}
                </span>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      <DashboardCard className="p-6">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">Daily roster cost by shift type</h2>
        {Object.keys(dailyRoster.byShiftType).length === 0 ? (
          <p className="mt-4 text-sm text-[#64748B]">No rostered shifts for this date.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 text-sm">
            {Object.entries(dailyRoster.byShiftType).map(([shiftType, bucket]) => (
              <li key={shiftType} className="flex justify-between gap-2 py-2 capitalize">
                <span className="text-[#CBD5E1]">
                  {shiftType.replace(/_/g, " ")} ({bucket.shiftCount})
                </span>
                <span className="text-[#E2E8F0]">
                  {formatCentsAsCurrency(bucket.grossCostCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="overflow-x-auto p-0">
        <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-[#F8FAFC]">
          Cost per procedure
        </h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Procedure</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Labour cost</th>
              <th className="px-4 py-3">Cost / hour</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {procedures.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#94A3B8]">
                  No procedures scheduled for this date.
                </td>
              </tr>
            ) : (
              procedures.map((proc) => (
                <tr key={proc.surgeryId} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3 font-medium text-[#F8FAFC]">{proc.procedureLabel}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">
                    {proc.teamSize}
                    {proc.missingProfileCount > 0 ? (
                      <span className="ml-1 text-xs text-amber-200">
                        ({proc.missingProfileCount} no profile)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">
                    {Math.round(proc.minutesWorked / 60)}h
                  </td>
                  <td className="px-4 py-3 text-[#22C1FF]">
                    {formatCentsAsCurrency(proc.totalGrossCostCents)}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">
                    {formatCostPerHour(proc.costPerProcedureHourCents)}
                  </td>
                  <td className="px-4 py-3 capitalize text-[#94A3B8]">
                    {proc.status.replace(/_/g, " ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DashboardCard>

      <DashboardCard className="overflow-x-auto p-0">
        <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-[#F8FAFC]">
          Surgery team labour ({surgeryTeam.assignmentCount} assignments)
        </h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Minutes</th>
              <th className="px-4 py-3">Gross cost</th>
            </tr>
          </thead>
          <tbody>
            {surgeryTeam.lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#94A3B8]">
                  No surgery team assignments for procedures on this date.
                </td>
              </tr>
            ) : (
              surgeryTeam.lines.map((line, idx) => (
                <tr key={`${line.staffMemberId}-${idx}`} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3 text-[#F8FAFC]">
                    {line.fullName}
                    {!line.hasWageProfile ? (
                      <span className="ml-2 text-xs text-amber-200">No profile</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 capitalize text-[#CBD5E1]">
                    {line.shiftType.replace(/^surgery_team:/, "").replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{line.minutesWorked}</td>
                  <td className="px-4 py-3 text-[#E2E8F0]">
                    {formatCentsAsCurrency(line.grossCostCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DashboardCard>

      <DashboardCard className="overflow-x-auto p-0">
        <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-[#F8FAFC]">
          Daily roster detail ({dailyRoster.shiftCount} shifts)
        </h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Shift type</th>
              <th className="px-4 py-3">Minutes</th>
              <th className="px-4 py-3">Gross cost</th>
            </tr>
          </thead>
          <tbody>
            {dailyRoster.lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#94A3B8]">
                  No roster shifts for this date.
                </td>
              </tr>
            ) : (
              dailyRoster.lines.map((line) => (
                <tr key={line.shiftId ?? `${line.staffMemberId}-${line.shiftType}`} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3 text-[#F8FAFC]">
                    {line.fullName}
                    {!line.hasWageProfile ? (
                      <span className="ml-2 text-xs text-amber-200">No profile</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 capitalize text-[#CBD5E1]">
                    {line.shiftType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{line.minutesWorked}</td>
                  <td className="px-4 py-3 text-[#E2E8F0]">
                    {formatCentsAsCurrency(line.grossCostCents)}
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