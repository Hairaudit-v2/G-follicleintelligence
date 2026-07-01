/**
 * WorkforceOS Phase 2 Sprint 3 — shift cost intelligence (pure analytics).
 */

import {
  computeGrossLabourCostCents,
  formatCentsAsCurrency,
  type AwardLoadingSnapshot,
  type WageRateType,
} from "./wageProfileCore";

export type ShiftCostLine = {
  shiftId: string | null;
  staffMemberId: string;
  fiStaffId: string | null;
  fullName: string;
  shiftType: string;
  minutesWorked: number;
  rateType: WageRateType;
  baseRateCents: number;
  awardLoadings: AwardLoadingSnapshot[];
  grossCostCents: number;
  hasWageProfile: boolean;
};

export type DailyRosterCostSummary = {
  workDate: string;
  shiftCount: number;
  totalScheduledMinutes: number;
  staffedCount: number;
  missingProfileCount: number;
  totalGrossCostCents: number;
  byShiftType: Record<string, { shiftCount: number; grossCostCents: number }>;
  lines: ShiftCostLine[];
};

export type SurgeryTeamCostSummary = {
  workDate: string;
  surgeryCount: number;
  assignmentCount: number;
  totalGrossCostCents: number;
  missingProfileCount: number;
  lines: ShiftCostLine[];
};

export type ProcedureLabourCost = {
  surgeryId: string;
  scheduledDate: string;
  procedureLabel: string;
  status: string;
  teamSize: number;
  minutesWorked: number;
  totalGrossCostCents: number;
  costPerProcedureHourCents: number;
  missingProfileCount: number;
  lines: ShiftCostLine[];
};

export type LabourEfficiencyMetrics = {
  workDate: string;
  shiftCount: number;
  profileCoveragePercent: number;
  costPerScheduledHourCents: number;
  averageCostPerShiftCents: number;
  labourEfficiencyIndex: number;
  missingProfileCount: number;
};

export type WeeklyWageExposureDay = {
  workDate: string;
  shiftCount: number;
  totalScheduledMinutes: number;
  forecastGrossCostCents: number;
  missingProfileCount: number;
};

export type WeeklyWageExposureForecast = {
  weekStart: string;
  weekEnd: string;
  totalForecastGrossCostCents: number;
  totalScheduledMinutes: number;
  averageDailyCostCents: number;
  days: WeeklyWageExposureDay[];
};

export type ShiftCostIntelligenceSnapshot = {
  workDate: string;
  dailyRoster: DailyRosterCostSummary;
  surgeryTeam: SurgeryTeamCostSummary;
  procedures: ProcedureLabourCost[];
  efficiency: LabourEfficiencyMetrics;
  weeklyForecast: WeeklyWageExposureForecast;
};

export function shiftMinutesBetween(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

export function enrichShiftCostLine(
  line: Omit<ShiftCostLine, "grossCostCents" | "hasWageProfile">
): ShiftCostLine {
  const hasWageProfile = line.baseRateCents > 0;
  return {
    ...line,
    hasWageProfile,
    grossCostCents: hasWageProfile
      ? computeGrossLabourCostCents({
          rateType: line.rateType,
          baseRateCents: line.baseRateCents,
          minutesWorked: line.minutesWorked,
          awardLoadings: line.awardLoadings,
        })
      : 0,
  };
}

export function computeDailyRosterCost(input: {
  workDate: string;
  lines: Omit<ShiftCostLine, "grossCostCents" | "hasWageProfile">[];
}): DailyRosterCostSummary {
  const enriched = input.lines.map(enrichShiftCostLine);
  const byShiftType: Record<string, { shiftCount: number; grossCostCents: number }> = {};

  for (const line of enriched) {
    const bucket = byShiftType[line.shiftType] ?? { shiftCount: 0, grossCostCents: 0 };
    bucket.shiftCount += 1;
    bucket.grossCostCents += line.grossCostCents;
    byShiftType[line.shiftType] = bucket;
  }

  return {
    workDate: input.workDate,
    shiftCount: enriched.length,
    totalScheduledMinutes: enriched.reduce((sum, l) => sum + l.minutesWorked, 0),
    staffedCount: enriched.filter((l) => l.hasWageProfile).length,
    missingProfileCount: enriched.filter((l) => !l.hasWageProfile).length,
    totalGrossCostCents: enriched.reduce((sum, l) => sum + l.grossCostCents, 0),
    byShiftType,
    lines: enriched,
  };
}

export function computeSurgeryTeamCost(input: {
  workDate: string;
  surgeryCount: number;
  lines: Omit<ShiftCostLine, "grossCostCents" | "hasWageProfile">[];
}): SurgeryTeamCostSummary {
  const enriched = input.lines.map(enrichShiftCostLine);
  return {
    workDate: input.workDate,
    surgeryCount: input.surgeryCount,
    assignmentCount: enriched.length,
    totalGrossCostCents: enriched.reduce((sum, l) => sum + l.grossCostCents, 0),
    missingProfileCount: enriched.filter((l) => !l.hasWageProfile).length,
    lines: enriched,
  };
}

export function computeProcedureLabourCosts(input: {
  procedures: {
    surgeryId: string;
    scheduledDate: string;
    procedureLabel: string;
    status: string;
    minutesWorked: number;
    lines: Omit<ShiftCostLine, "grossCostCents" | "hasWageProfile">[];
  }[];
}): ProcedureLabourCost[] {
  return input.procedures.map((proc) => {
    const enriched = proc.lines.map(enrichShiftCostLine);
    const totalGrossCostCents = enriched.reduce((sum, l) => sum + l.grossCostCents, 0);
    const hours = Math.max(proc.minutesWorked / 60, 0.25);
    return {
      surgeryId: proc.surgeryId,
      scheduledDate: proc.scheduledDate,
      procedureLabel: proc.procedureLabel,
      status: proc.status,
      teamSize: enriched.length,
      minutesWorked: proc.minutesWorked,
      totalGrossCostCents,
      costPerProcedureHourCents: Math.round(totalGrossCostCents / hours),
      missingProfileCount: enriched.filter((l) => !l.hasWageProfile).length,
      lines: enriched,
    };
  });
}

export function computeLabourEfficiencyMetrics(
  dailyRoster: DailyRosterCostSummary
): LabourEfficiencyMetrics {
  const shiftCount = dailyRoster.shiftCount;
  const profileCoveragePercent =
    shiftCount === 0
      ? 100
      : Math.round((dailyRoster.staffedCount / shiftCount) * 1000) / 10;
  const scheduledHours = dailyRoster.totalScheduledMinutes / 60;
  const costPerScheduledHourCents =
    scheduledHours > 0
      ? Math.round(dailyRoster.totalGrossCostCents / scheduledHours)
      : 0;
  const averageCostPerShiftCents =
    shiftCount > 0 ? Math.round(dailyRoster.totalGrossCostCents / shiftCount) : 0;
  const labourEfficiencyIndex = Math.round(
    profileCoveragePercent * (dailyRoster.totalGrossCostCents > 0 ? 1 : 0.5)
  );

  return {
    workDate: dailyRoster.workDate,
    shiftCount,
    profileCoveragePercent,
    costPerScheduledHourCents,
    averageCostPerShiftCents,
    labourEfficiencyIndex: Math.min(100, labourEfficiencyIndex),
    missingProfileCount: dailyRoster.missingProfileCount,
  };
}

export function computeWeeklyWageExposure(input: {
  weekStart: string;
  days: {
    workDate: string;
    lines: Omit<ShiftCostLine, "grossCostCents" | "hasWageProfile">[];
  }[];
}): WeeklyWageExposureForecast {
  const daySummaries = input.days.map((day) => {
    const enriched = day.lines.map(enrichShiftCostLine);
    return {
      workDate: day.workDate,
      shiftCount: enriched.length,
      totalScheduledMinutes: enriched.reduce((sum, l) => sum + l.minutesWorked, 0),
      forecastGrossCostCents: enriched.reduce((sum, l) => sum + l.grossCostCents, 0),
      missingProfileCount: enriched.filter((l) => !l.hasWageProfile).length,
    };
  });

  const totalForecastGrossCostCents = daySummaries.reduce(
    (sum, d) => sum + d.forecastGrossCostCents,
    0
  );
  const totalScheduledMinutes = daySummaries.reduce(
    (sum, d) => sum + d.totalScheduledMinutes,
    0
  );

  return {
    weekStart: input.weekStart,
    weekEnd: daySummaries[daySummaries.length - 1]?.workDate ?? input.weekStart,
    totalForecastGrossCostCents,
    totalScheduledMinutes,
    averageDailyCostCents:
      daySummaries.length > 0
        ? Math.round(totalForecastGrossCostCents / daySummaries.length)
        : 0,
    days: daySummaries,
  };
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatCostPerHour(cents: number, currency = "AUD"): string {
  return `${formatCentsAsCurrency(cents, currency)}/hr`;
}