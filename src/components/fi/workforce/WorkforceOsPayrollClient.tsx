"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import {
  managerAddBreakToPunchAction,
  managerCloseForgottenPunchAction,
  updateWorkforceTimeClockBreaksEnabledAction,
  updateWorkforceTimeClockPolicyAction,
} from "@/src/lib/actions/staff-time-clock-actions";
import type { PayPeriodRange, PayPeriodStaffTotal } from "@/src/lib/workforce/payPeriodCore";
import { PAY_PERIOD_FREQUENCIES } from "@/src/lib/workforce/payPeriodCore";
import type { RosterActualVarianceRow } from "@/src/lib/workforce/rosterActualVarianceCore";
import type { WorkforceTimeClockPolicy } from "@/src/lib/workforce/staffTimeClockPolicyCore";
import {
  bulkTransitionTimesheetEntriesAction,
  createTimesheetEntryAction,
  transitionTimesheetEntryAction,
  upsertWorkforceWageProfileAction,
} from "@/src/lib/actions/workforce-phase-2-sprint-2-actions";
import {
  countTimesheetEntriesByStatus,
  isTimesheetLocked,
  TIMESHEET_STATUS_LABELS,
} from "@/src/lib/workforce/timesheetApprovalCore";
import type { WorkforceTimePunch } from "@/src/lib/workforce/staffTimeClockCore";
import {
  DEFAULT_AWARD_LOADING_SEEDS,
  formatCentsAsCurrency,
  WAGE_RATE_TYPE_LABELS,
  WAGE_RATE_TYPES,
  type AwardLoadingPlaceholder,
  type SurgeryDayStaffingCostSummary,
  type TimesheetEntry,
  type WageRateType,
  type WorkforceWageProfile,
} from "@/src/lib/workforce/wageProfileCore";

function formatPunchTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function WorkforceOsPayrollClient({
  tenantId,
  wageProfiles,
  awardLoadings,
  timesheetEntries,
  timePunches,
  staffOptions,
  surgeryDayCost,
  rateTypeCounts,
  workDate,
  canManage,
  breaksEnabled,
  timeClockPolicy,
  payPeriod,
  payPeriodStaffTotals,
  rosterVariance,
  autoClosedPunches,
  openPunches,
}: {
  tenantId: string;
  wageProfiles: WorkforceWageProfile[];
  awardLoadings: AwardLoadingPlaceholder[];
  timesheetEntries: TimesheetEntry[];
  timePunches: WorkforceTimePunch[];
  staffOptions: {
    id: string;
    fullName: string;
    fiStaffId: string | null;
    hasWageProfile: boolean;
  }[];
  surgeryDayCost: SurgeryDayStaffingCostSummary;
  rateTypeCounts: Record<WageRateType, number>;
  workDate: string;
  canManage: boolean;
  breaksEnabled: boolean;
  timeClockPolicy: WorkforceTimeClockPolicy;
  payPeriod: PayPeriodRange;
  payPeriodStaffTotals: PayPeriodStaffTotal[];
  rosterVariance: RosterActualVarianceRow[];
  autoClosedPunches: WorkforceTimePunch[];
  openPunches: WorkforceTimePunch[];
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const kioskUrl = `/fi-admin/${tenantId}/staff-time-clock`;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWageForm, setShowWageForm] = useState(false);
  const [showTimesheetForm, setShowTimesheetForm] = useState(false);
  const [costDate, setCostDate] = useState(workDate);

  const [wageForm, setWageForm] = useState({
    wageProfileId: "",
    staffMemberId: "",
    rateType: "hourly" as WageRateType,
    baseRateDollars: "",
    awardCode: "PLACEHOLDER_AWARD",
    awardLoadingCodes: [] as string[],
    notes: "",
  });

  const [timesheetForm, setTimesheetForm] = useState({
    staffMemberId: "",
    workDate: workDate,
    entryType: "regular",
    minutesWorked: "480",
    notes: "",
  });

  const [correctingPunchId, setCorrectingPunchId] = useState<string | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    clockOutAt: "",
    notes: "",
  });
  const [addingBreakPunchId, setAddingBreakPunchId] = useState<string | null>(null);
  const [breakForm, setBreakForm] = useState({
    breakStartAt: "",
    breakEndAt: "",
    notes: "",
  });

  const staffWithoutProfile = useMemo(
    () => staffOptions.filter((s) => !s.hasWageProfile),
    [staffOptions]
  );

  const timesheetStatusCounts = useMemo(
    () => countTimesheetEntriesByStatus(timesheetEntries),
    [timesheetEntries]
  );

  const loadingCodes = useMemo(() => {
    const fromDb = awardLoadings.map((a) => a.loadingCode);
    const seeds = DEFAULT_AWARD_LOADING_SEEDS.map((s) => s.loadingCode);
    return Array.from(new Set([...fromDb, ...seeds]));
  }, [awardLoadings]);

  function resetFeedback() {
    setMessage(null);
    setError(null);
  }

  function onWageSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    startTransition(async () => {
      const res = await upsertWorkforceWageProfileAction(tenantId, {
        wageProfileId: wageForm.wageProfileId || undefined,
        staffMemberId: wageForm.staffMemberId,
        rateType: wageForm.rateType,
        baseRateDollars: Number(wageForm.baseRateDollars),
        awardCode: wageForm.awardCode || undefined,
        awardLoadingCodes: wageForm.awardLoadingCodes,
        notes: wageForm.notes || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Wage profile saved.");
      setShowWageForm(false);
      router.refresh();
    });
  }

  function onCloseForgottenPunch(e: React.FormEvent) {
    e.preventDefault();
    if (!correctingPunchId) return;
    resetFeedback();
    startTransition(async () => {
      const res = await managerCloseForgottenPunchAction(tenantId, {
        punchId: correctingPunchId,
        clockOutAt: new Date(correctionForm.clockOutAt).toISOString(),
        notes: correctionForm.notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        res.timesheetEntryId
          ? "Punch closed and draft timesheet created."
          : "Punch closed. Timesheet pending — check wage profile."
      );
      setCorrectingPunchId(null);
      setCorrectionForm({ clockOutAt: "", notes: "" });
      router.refresh();
    });
  }

  function onAddManagerBreak(e: React.FormEvent) {
    e.preventDefault();
    if (!addingBreakPunchId) return;
    resetFeedback();
    startTransition(async () => {
      const res = await managerAddBreakToPunchAction(tenantId, {
        punchId: addingBreakPunchId,
        breakStartAt: new Date(breakForm.breakStartAt).toISOString(),
        breakEndAt: new Date(breakForm.breakEndAt).toISOString(),
        notes: breakForm.notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Break recorded on punch.");
      setAddingBreakPunchId(null);
      setBreakForm({ breakStartAt: "", breakEndAt: "", notes: "" });
      router.refresh();
    });
  }

  function onTimesheetSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    startTransition(async () => {
      const res = await createTimesheetEntryAction(tenantId, {
        staffMemberId: timesheetForm.staffMemberId,
        workDate: timesheetForm.workDate,
        entryType: timesheetForm.entryType,
        minutesWorked: Number(timesheetForm.minutesWorked),
        notes: timesheetForm.notes || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Timesheet entry created (draft).");
      setShowTimesheetForm(false);
      router.refresh();
    });
  }

  function startEditProfile(profile: WorkforceWageProfile) {
    setWageForm({
      wageProfileId: profile.id,
      staffMemberId: profile.staffMemberId,
      rateType: profile.rateType,
      baseRateDollars: String(profile.baseRateCents / 100),
      awardCode: profile.awardCode ?? "PLACEHOLDER_AWARD",
      awardLoadingCodes: profile.awardLoadingCodes,
      notes: profile.notes ?? "",
    });
    setShowWageForm(true);
  }

  function onCostDateChange(next: string) {
    setCostDate(next);
    router.push(`${base}/payroll?date=${encodeURIComponent(next)}`);
  }

  function runTimesheetTransition(
    entryId: string,
    action: "submit" | "approve" | "void" | "revert_to_draft"
  ) {
    resetFeedback();
    let voidReason: string | undefined;
    if (action === "void") {
      const reason = window.prompt("Reason for voiding this timesheet entry:");
      if (!reason?.trim()) return;
      voidReason = reason.trim();
    }
    startTransition(async () => {
      const res = await transitionTimesheetEntryAction(tenantId, {
        entryId,
        action,
        voidReason,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(`Timesheet marked as ${TIMESHEET_STATUS_LABELS[res.status]}.`);
      router.refresh();
    });
  }

  function runBulkTimesheetTransition(
    action: "submit" | "approve",
    fromStatus: "draft" | "submitted"
  ) {
    resetFeedback();
    startTransition(async () => {
      const res = await bulkTransitionTimesheetEntriesAction(tenantId, {
        action,
        fromStatus,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        `${res.updated} timesheet${res.updated === 1 ? "" : "s"} updated` +
          (res.skipped > 0 ? ` (${res.skipped} skipped).` : ".")
      );
      router.refresh();
    });
  }

  function onToggleBreaksEnabled(next: boolean) {
    resetFeedback();
    startTransition(async () => {
      const res = await updateWorkforceTimeClockBreaksEnabledAction(tenantId, {
        breaksEnabled: next,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        res.breaksEnabled
          ? "Break tracking enabled for this clinic."
          : "Break tracking disabled for this clinic."
      );
      setAddingBreakPunchId(null);
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
          <h1 className="mt-2 text-2xl font-semibold text-[#F8FAFC]">Payroll & wage engine</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">
            Staff wage profiles, award loading placeholders, surgery-day staffing cost, and
            timesheet-ready labour entries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={base}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5"
          >
            Staff directory
          </Link>
          {canManage ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowTimesheetForm((v) => !v)}>
                {showTimesheetForm ? "Close timesheet" : "Add timesheet entry"}
              </Button>
              <Button size="sm" onClick={() => setShowWageForm((v) => !v)}>
                {showWageForm ? "Close wage form" : "Add wage profile"}
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <DashboardCard className="p-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <dt className="text-[#64748B]">Active wage profiles</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{wageProfiles.length}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Staff without profile</dt>
            <dd className="mt-1 text-xl font-semibold text-amber-100">
              {staffWithoutProfile.length}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Draft</dt>
            <dd className="mt-1 text-xl font-semibold text-[#94A3B8]">
              {timesheetStatusCounts.draft}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Submitted</dt>
            <dd className="mt-1 text-xl font-semibold text-amber-100">
              {timesheetStatusCounts.submitted}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Approved</dt>
            <dd className="mt-1 text-xl font-semibold text-emerald-200">
              {timesheetStatusCounts.approved}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Ready for pay</dt>
            <dd className="mt-1 text-sm text-[#E2E8F0]">
              {formatCentsAsCurrency(
                timesheetEntries
                  .filter((t) => t.status === "approved")
                  .reduce((sum, t) => sum + t.grossCostCents, 0)
              )}
            </dd>
          </div>
        </dl>
      </DashboardCard>

      {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <DashboardCard className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#F8FAFC]">Pay period</h2>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {payPeriod.label} ({payPeriod.start} → {payPeriod.end}) · {payPeriod.frequency}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Link
              href={kioskUrl}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-cyan-200 hover:bg-white/5"
            >
              Open time clock kiosk
            </Link>
            <label className="text-xs text-[#94A3B8]">
              Period anchor
              <input
                type="date"
                className="ml-2 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-[#F8FAFC]"
                defaultValue={payPeriod.end}
                onChange={(e) => {
                  if (e.target.value) {
                    router.push(`${base}/payroll?period=${encodeURIComponent(e.target.value)}`);
                  }
                }}
              />
            </label>
          </div>
        </div>
        {canManage ? (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-white/[0.06] pt-4 text-xs text-[#CBD5E1]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={timeClockPolicy.autoCloseEnabled}
                disabled={pending}
                onChange={(e) => {
                  startTransition(async () => {
                    const res = await updateWorkforceTimeClockPolicyAction(tenantId, {
                      autoCloseEnabled: e.target.checked,
                    });
                    if (res.ok) router.refresh();
                  });
                }}
              />
              Auto-close forgotten punches (nightly)
            </label>
            <label>
              Pay frequency
              <select
                className="ml-2 rounded border border-white/10 bg-white/5 px-2 py-1"
                value={timeClockPolicy.payPeriodFrequency}
                disabled={pending}
                onChange={(e) => {
                  startTransition(async () => {
                    await updateWorkforceTimeClockPolicyAction(tenantId, {
                      payPeriodFrequency: e.target.value,
                    });
                    router.refresh();
                  });
                }}
              >
                {PAY_PERIOD_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <table className="mt-4 min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="py-2 pr-4">Staff</th>
              <th className="py-2 pr-4">Minutes</th>
              <th className="py-2 pr-4">Gross</th>
              <th className="py-2">Approved entries</th>
            </tr>
          </thead>
          <tbody>
            {payPeriodStaffTotals.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-[#94A3B8]">
                  No timesheet entries in this pay period.
                </td>
              </tr>
            ) : (
              payPeriodStaffTotals.map((row) => (
                <tr key={row.staffMemberId} className="border-t border-white/[0.06]">
                  <td className="py-2 pr-4 text-[#F8FAFC]">{row.staffFullName ?? "—"}</td>
                  <td className="py-2 pr-4 text-[#CBD5E1]">{row.minutesWorked}</td>
                  <td className="py-2 pr-4 text-[#CBD5E1]">
                    {formatCentsAsCurrency(row.grossCostCents)}
                  </td>
                  <td className="py-2 text-[#94A3B8]">
                    {row.approvedCount} / {row.entryCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DashboardCard>

      {(openPunches.length > 0 || autoClosedPunches.length > 0) && canManage ? (
        <DashboardCard className="p-4">
          <h2 className="text-sm font-semibold text-[#F8FAFC]">HR review queue</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Open punches need attention; auto-closed punches should be verified.
          </p>
          {openPunches.length > 0 ? (
            <p className="mt-3 text-sm text-amber-200">
              {openPunches.length} open punch{openPunches.length === 1 ? "" : "es"} still running.
            </p>
          ) : null}
          {autoClosedPunches.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-[#CBD5E1]">
              {autoClosedPunches.slice(0, 5).map((p) => (
                <li key={p.id}>
                  {p.staffFullName ?? "Staff"} · {p.workDate} · auto-closed
                </li>
              ))}
            </ul>
          ) : null}
        </DashboardCard>
      ) : null}

      {rosterVariance.length > 0 ? (
        <DashboardCard className="overflow-x-auto p-0">
          <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-[#F8FAFC]">
            Roster vs actual
          </h2>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Variance</th>
                <th className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody>
              {rosterVariance.slice(0, 30).map((row, i) => (
                <tr key={`${row.punchId ?? row.shiftId ?? i}`} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3 text-[#F8FAFC]">{row.staffFullName ?? "—"}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{row.workDate}</td>
                  <td className="px-4 py-3 capitalize text-amber-200">
                    {row.kind.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-[#94A3B8]">{row.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardCard>
      ) : null}

      <DashboardCard className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Surgery day staffing cost</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Estimated gross labour cost from surgery-day roster shifts and wage profiles.
            </p>
          </div>
          <label className="text-sm text-[#94A3B8]">
            Date
            <input
              type="date"
              value={costDate}
              onChange={(e) => onCostDateChange(e.target.value)}
              className="ml-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[#F8FAFC]"
            />
          </label>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[#64748B]">Surgery shifts</dt>
            <dd className="mt-1 text-lg font-semibold text-[#F8FAFC]">
              {surgeryDayCost.shiftCount}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">With wage profile</dt>
            <dd className="mt-1 text-lg font-semibold text-emerald-200">
              {surgeryDayCost.staffedCount}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Missing profile</dt>
            <dd className="mt-1 text-lg font-semibold text-amber-100">
              {surgeryDayCost.missingProfileCount}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Total gross cost</dt>
            <dd className="mt-1 text-lg font-semibold text-[#22C1FF]">
              {formatCentsAsCurrency(surgeryDayCost.totalGrossCostCents)}
            </dd>
          </div>
        </dl>
        {surgeryDayCost.lines.length > 0 ? (
          <ul className="mt-4 divide-y divide-white/10 text-sm">
            {surgeryDayCost.lines.map((line) => (
              <li key={line.shiftId} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-[#E2E8F0]">
                  {line.fullName}
                  {!line.hasWageProfile ? (
                    <span className="ml-2 text-xs text-amber-200">No wage profile</span>
                  ) : null}
                </span>
                <span className="text-[#94A3B8]">
                  {Math.round(line.minutesWorked / 60)}h ·{" "}
                  {formatCentsAsCurrency(line.grossCostCents)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[#64748B]">No surgery-day shifts scheduled for this date.</p>
        )}
      </DashboardCard>

      {canManage && showWageForm ? (
        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">
            {wageForm.wageProfileId ? "Edit wage profile" : "New wage profile"}
          </h2>
          <form onSubmit={onWageSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Staff member *</span>
              <select
                required
                disabled={Boolean(wageForm.wageProfileId)}
                value={wageForm.staffMemberId}
                onChange={(e) => setWageForm((f) => ({ ...f, staffMemberId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              >
                <option value="">— Select —</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                    {s.hasWageProfile ? " (has profile)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Rate type *</span>
              <select
                value={wageForm.rateType}
                onChange={(e) =>
                  setWageForm((f) => ({ ...f, rateType: e.target.value as WageRateType }))
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              >
                {WAGE_RATE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WAGE_RATE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Base rate (AUD) *</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={wageForm.baseRateDollars}
                onChange={(e) => setWageForm((f) => ({ ...f, baseRateDollars: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Award code (placeholder)</span>
              <input
                value={wageForm.awardCode}
                onChange={(e) => setWageForm((f) => ({ ...f, awardCode: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <fieldset className="block text-sm sm:col-span-2">
              <legend className="text-[#94A3B8]">Award loadings (placeholder)</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {loadingCodes.map((code) => (
                  <label key={code} className="flex items-center gap-2 text-xs text-[#CBD5E1]">
                    <input
                      type="checkbox"
                      checked={wageForm.awardLoadingCodes.includes(code)}
                      onChange={(e) => {
                        setWageForm((f) => ({
                          ...f,
                          awardLoadingCodes: e.target.checked
                            ? [...f.awardLoadingCodes, code]
                            : f.awardLoadingCodes.filter((c) => c !== code),
                        }));
                      }}
                    />
                    {code.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[#94A3B8]">Notes</span>
              <textarea
                value={wageForm.notes}
                onChange={(e) => setWageForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                Save wage profile
              </Button>
            </div>
          </form>
        </DashboardCard>
      ) : null}

      {canManage && showTimesheetForm ? (
        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Timesheet entry (draft)</h2>
          <form onSubmit={onTimesheetSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Staff member *</span>
              <select
                required
                value={timesheetForm.staffMemberId}
                onChange={(e) =>
                  setTimesheetForm((f) => ({ ...f, staffMemberId: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              >
                <option value="">— Select —</option>
                {staffOptions
                  .filter((s) => s.hasWageProfile)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Work date *</span>
              <input
                required
                type="date"
                value={timesheetForm.workDate}
                onChange={(e) => setTimesheetForm((f) => ({ ...f, workDate: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Minutes worked *</span>
              <input
                required
                type="number"
                min="0"
                step="15"
                value={timesheetForm.minutesWorked}
                onChange={(e) =>
                  setTimesheetForm((f) => ({ ...f, minutesWorked: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Entry type</span>
              <select
                value={timesheetForm.entryType}
                onChange={(e) => setTimesheetForm((f) => ({ ...f, entryType: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              >
                <option value="regular">Regular</option>
                <option value="overtime">Overtime</option>
                <option value="surgery_day">Surgery day</option>
                <option value="admin">Admin</option>
                <option value="leave">Leave</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[#94A3B8]">Notes</span>
              <textarea
                value={timesheetForm.notes}
                onChange={(e) => setTimesheetForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                Create draft entry
              </Button>
            </div>
          </form>
        </DashboardCard>
      ) : null}

      {awardLoadings.length > 0 ? (
        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Award loading placeholders</h2>
          <ul className="mt-4 divide-y divide-white/10 text-sm">
            {awardLoadings.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-[#E2E8F0]">
                  {a.displayName}{" "}
                  <span className="text-xs text-[#64748B]">
                    ({a.awardCode} · {a.loadingCode})
                  </span>
                </span>
                <span className="text-[#94A3B8]">×{a.loadingMultiplier.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <DashboardCard className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Rate type</th>
              <th className="px-4 py-3">Base rate</th>
              <th className="px-4 py-3">Award</th>
              <th className="px-4 py-3">Loadings</th>
              {canManage ? <th className="px-4 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {wageProfiles.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 6 : 5}
                  className="px-4 py-8 text-center text-[#94A3B8]"
                >
                  No wage profiles yet. Add profiles to enable surgery-day cost and timesheet entries.
                </td>
              </tr>
            ) : (
              wageProfiles.map((profile) => (
                <tr key={profile.id} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3 font-medium text-[#F8FAFC]">
                    {profile.staffFullName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">
                    {WAGE_RATE_TYPE_LABELS[profile.rateType]}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">
                    {formatCentsAsCurrency(profile.baseRateCents, profile.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {profile.awardCode ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {profile.awardLoadingCodes.length > 0
                      ? profile.awardLoadingCodes.join(", ")
                      : "—"}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" onClick={() => startEditProfile(profile)}>
                        Edit
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DashboardCard>

      <DashboardCard className="overflow-x-auto p-0">
        <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-[#F8FAFC]">
          PIN time clock
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <p className="text-xs text-[#94A3B8]">
            Staff clock in on PIN sign-in and clock out on sign-out.
            {breaksEnabled
              ? " Breaks are deducted from gross minutes for paid time."
              : " Break tracking is off — paid time uses full clock-in to clock-out span."}{" "}
            HR can close forgotten open punches below.
          </p>
          {canManage ? (
            <label className="flex shrink-0 items-center gap-2 text-xs text-[#CBD5E1]">
              <input
                type="checkbox"
                className="rounded border-white/20 bg-white/5"
                checked={breaksEnabled}
                disabled={pending}
                onChange={(e) => onToggleBreaksEnabled(e.target.checked)}
              />
              Enable break tracking
            </label>
          ) : null}
        </div>
        {canManage && correctingPunchId ? (
          <form
            onSubmit={onCloseForgottenPunch}
            className="space-y-3 border-b border-white/[0.06] px-4 py-4"
          >
            <p className="text-xs font-semibold text-[#F8FAFC]">Close forgotten punch</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-[#94A3B8]">
                Clock-out time
                <input
                  type="datetime-local"
                  required
                  className="mt-1 block w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#F8FAFC]"
                  value={correctionForm.clockOutAt}
                  onChange={(e) =>
                    setCorrectionForm((f) => ({ ...f, clockOutAt: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs text-[#94A3B8] sm:col-span-2">
                Correction note
                <input
                  required
                  className="mt-1 block w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#F8FAFC]"
                  value={correctionForm.notes}
                  onChange={(e) => setCorrectionForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Staff forgot to clock out — left at 5:30pm"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Save correction
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCorrectingPunchId(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
        {canManage && breaksEnabled && addingBreakPunchId ? (
          <form
            onSubmit={onAddManagerBreak}
            className="space-y-3 border-b border-white/[0.06] px-4 py-4"
          >
            <p className="text-xs font-semibold text-[#F8FAFC]">Add break to punch</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-[#94A3B8]">
                Break start
                <input
                  type="datetime-local"
                  required
                  className="mt-1 block w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#F8FAFC]"
                  value={breakForm.breakStartAt}
                  onChange={(e) =>
                    setBreakForm((f) => ({ ...f, breakStartAt: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs text-[#94A3B8]">
                Break end
                <input
                  type="datetime-local"
                  required
                  className="mt-1 block w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#F8FAFC]"
                  value={breakForm.breakEndAt}
                  onChange={(e) =>
                    setBreakForm((f) => ({ ...f, breakEndAt: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs text-[#94A3B8] sm:col-span-2">
                Note
                <input
                  required
                  className="mt-1 block w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#F8FAFC]"
                  value={breakForm.notes}
                  onChange={(e) => setBreakForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Add break
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAddingBreakPunchId(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Clock in</th>
              <th className="px-4 py-3">Clock out</th>
              {breaksEnabled ? <th className="px-4 py-3">Breaks</th> : null}
              <th className="px-4 py-3">{breaksEnabled ? "Net min" : "Minutes"}</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Timesheet</th>
              {canManage ? <th className="px-4 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {timePunches.length === 0 ? (
              <tr>
                <td
                  colSpan={(canManage ? 9 : 8) - (breaksEnabled ? 0 : 1)}
                  className="px-4 py-8 text-center text-[#94A3B8]"
                >
                  No PIN clock punches yet.
                </td>
              </tr>
            ) : (
              timePunches.map((punch) => (
                <tr key={punch.id} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3 text-[#F8FAFC]">{punch.staffFullName ?? "—"}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{punch.workDate}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{formatPunchTime(punch.clockInAt)}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{formatPunchTime(punch.clockOutAt)}</td>
                  {breaksEnabled ? (
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {punch.breakMinutes > 0
                        ? `${punch.breakMinutes} min`
                        : punch.hasOpenBreak
                          ? "On break"
                          : "—"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-[#CBD5E1]">
                    {punch.minutesWorked ?? (punch.status === "open" ? "In progress" : "—")}
                  </td>
                  <td className="px-4 py-3 capitalize text-[#94A3B8]">{punch.status}</td>
                  <td className="px-4 py-3 text-[#94A3B8]">
                    {punch.timesheetEntryId
                      ? TIMESHEET_STATUS_LABELS[
                          timesheetEntries.find((t) => t.id === punch.timesheetEntryId)?.status ??
                            "draft"
                        ]
                      : punch.status === "open"
                        ? "—"
                        : "Pending"}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {punch.status === "open" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAddingBreakPunchId(null);
                              setCorrectingPunchId(punch.id);
                            }}
                          >
                            Close punch
                          </Button>
                        ) : null}
                        {breaksEnabled ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCorrectingPunchId(null);
                              setAddingBreakPunchId(punch.id);
                            }}
                          >
                            Add break
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DashboardCard>

      <DashboardCard className="overflow-x-auto p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[#F8FAFC]">Timesheet approval</h2>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Draft → submit for review → approve to lock for pay. Approved entries cannot be edited.
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {timesheetStatusCounts.draft > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => runBulkTimesheetTransition("submit", "draft")}
                >
                  Submit all drafts ({timesheetStatusCounts.draft})
                </Button>
              ) : null}
              {timesheetStatusCounts.submitted > 0 ? (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => runBulkTimesheetTransition("approve", "submitted")}
                >
                  Approve all submitted ({timesheetStatusCounts.submitted})
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Minutes</th>
              <th className="px-4 py-3">Gross cost</th>
              <th className="px-4 py-3">Status</th>
              {canManage ? <th className="px-4 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {timesheetEntries.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-[#94A3B8]">
                  No timesheet entries yet.
                </td>
              </tr>
            ) : (
              timesheetEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3 text-[#F8FAFC]">{entry.staffFullName ?? "—"}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{entry.workDate}</td>
                  <td className="px-4 py-3 capitalize text-[#CBD5E1]">
                    {entry.entryType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{entry.minutesWorked}</td>
                  <td className="px-4 py-3 text-[#CBD5E1]">
                    {formatCentsAsCurrency(entry.grossCostCents)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        entry.status === "approved"
                          ? "text-emerald-300"
                          : entry.status === "submitted"
                            ? "text-amber-200"
                            : entry.status === "void"
                              ? "text-red-300/80"
                              : "text-[#94A3B8]"
                      }
                    >
                      {TIMESHEET_STATUS_LABELS[entry.status]}
                      {isTimesheetLocked(entry.status) && entry.status === "approved"
                        ? " · locked"
                        : ""}
                    </span>
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      {!isTimesheetLocked(entry.status) ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.status === "draft" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => runTimesheetTransition(entry.id, "submit")}
                              >
                                Submit
                              </Button>
                              <Button
                                size="sm"
                                disabled={pending}
                                onClick={() => runTimesheetTransition(entry.id, "approve")}
                              >
                                Approve
                              </Button>
                            </>
                          ) : null}
                          {entry.status === "submitted" ? (
                            <>
                              <Button
                                size="sm"
                                disabled={pending}
                                onClick={() => runTimesheetTransition(entry.id, "approve")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() =>
                                  runTimesheetTransition(entry.id, "revert_to_draft")
                                }
                              >
                                Revert
                              </Button>
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => runTimesheetTransition(entry.id, "void")}
                          >
                            Void
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#64748B]">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DashboardCard>
    </div>
  );
}