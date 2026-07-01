/**
 * WorkforceOS Phase 2 Sprint 2 — payroll / wage engine (pure types + cost math).
 */

export const WAGE_RATE_TYPES = ["hourly", "daily", "contractor"] as const;
export type WageRateType = (typeof WAGE_RATE_TYPES)[number];

export const TIMESHEET_ENTRY_TYPES = [
  "regular",
  "overtime",
  "break",
  "leave",
  "surgery_day",
  "admin",
] as const;
export type TimesheetEntryType = (typeof TIMESHEET_ENTRY_TYPES)[number];

export const TIMESHEET_STATUSES = ["draft", "submitted", "approved", "void"] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

export const WAGE_RATE_TYPE_LABELS: Record<WageRateType, string> = {
  hourly: "Hourly",
  daily: "Daily",
  contractor: "Contractor (day rate)",
};

export const DEFAULT_AWARD_LOADING_SEEDS = [
  { loadingCode: "weekend", displayName: "Weekend loading", multiplier: 1.5 },
  { loadingCode: "overtime", displayName: "Overtime loading", multiplier: 1.5 },
  { loadingCode: "public_holiday", displayName: "Public holiday loading", multiplier: 2.0 },
  { loadingCode: "on_call", displayName: "On-call loading", multiplier: 1.25 },
] as const;

export type AwardLoadingSnapshot = {
  loadingCode: string;
  displayName: string;
  multiplier: number;
};

export type WorkforceWageProfile = {
  id: string;
  tenantId: string;
  staffMemberId: string;
  fiStaffId: string | null;
  staffFullName: string | null;
  rateType: WageRateType;
  baseRateCents: number;
  currency: string;
  awardCode: string | null;
  awardLoadingCodes: string[];
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AwardLoadingPlaceholder = {
  id: string;
  tenantId: string;
  awardCode: string;
  loadingCode: string;
  displayName: string;
  loadingMultiplier: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TimesheetEntry = {
  id: string;
  tenantId: string;
  staffMemberId: string;
  staffFullName: string | null;
  wageProfileId: string | null;
  shiftId: string | null;
  workDate: string;
  entryType: TimesheetEntryType;
  minutesWorked: number;
  rateTypeSnapshot: WageRateType;
  baseRateCentsSnapshot: number;
  awardLoadingsSnapshot: AwardLoadingSnapshot[];
  grossCostCents: number;
  status: TimesheetStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SurgeryDayStaffCostLine = {
  staffMemberId: string;
  fiStaffId: string | null;
  fullName: string;
  shiftId: string;
  shiftType: string;
  minutesWorked: number;
  rateType: WageRateType;
  baseRateCents: number;
  awardLoadings: AwardLoadingSnapshot[];
  grossCostCents: number;
  hasWageProfile: boolean;
};

export type SurgeryDayStaffingCostSummary = {
  workDate: string;
  shiftCount: number;
  staffedCount: number;
  missingProfileCount: number;
  totalGrossCostCents: number;
  lines: SurgeryDayStaffCostLine[];
};

export function isWageRateType(value: string): value is WageRateType {
  return (WAGE_RATE_TYPES as readonly string[]).includes(value);
}

export function isTimesheetEntryType(value: string): value is TimesheetEntryType {
  return (TIMESHEET_ENTRY_TYPES as readonly string[]).includes(value);
}

export function isTimesheetStatus(value: string): value is TimesheetStatus {
  return (TIMESHEET_STATUSES as readonly string[]).includes(value);
}

export function normalizeWageRateType(
  raw: string | null | undefined,
  fallback: WageRateType = "hourly"
): WageRateType {
  const s = raw?.trim().toLowerCase() ?? "";
  return isWageRateType(s) ? s : fallback;
}

/** Convert dollars (e.g. 42.50) to integer cents. */
export function dollarsToCents(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Rate must be a positive number.");
  }
  return Math.round(amount * 100);
}

/** Format cents as AUD currency string. */
export function formatCentsAsCurrency(cents: number, currency = "AUD"): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Base labour cost before award loading premiums. */
export function computeBaseLabourCostCents(input: {
  rateType: WageRateType;
  baseRateCents: number;
  minutesWorked: number;
}): number {
  const minutes = Math.max(0, Math.floor(input.minutesWorked));
  if (minutes === 0) return 0;

  if (input.rateType === "hourly") {
    return Math.round((input.baseRateCents * minutes) / 60);
  }

  // Daily / contractor: full day from 4h+, else prorate to 8h day.
  const dayFraction = Math.min(1, minutes / (8 * 60));
  return Math.round(input.baseRateCents * dayFraction);
}

/** Apply award loading placeholders as additive premiums on base cost. */
export function applyAwardLoadingPremiums(
  baseCostCents: number,
  loadings: Pick<AwardLoadingSnapshot, "multiplier">[]
): number {
  if (baseCostCents <= 0 || loadings.length === 0) return baseCostCents;
  const premium = loadings.reduce((sum, l) => {
    const mult = Number.isFinite(l.multiplier) && l.multiplier > 0 ? l.multiplier : 1;
    return sum + Math.round(baseCostCents * Math.max(0, mult - 1));
  }, 0);
  return baseCostCents + premium;
}

export function computeGrossLabourCostCents(input: {
  rateType: WageRateType;
  baseRateCents: number;
  minutesWorked: number;
  awardLoadings?: Pick<AwardLoadingSnapshot, "multiplier">[];
}): number {
  const base = computeBaseLabourCostCents(input);
  return applyAwardLoadingPremiums(base, input.awardLoadings ?? []);
}

export function computeSurgeryDayStaffingCost(input: {
  workDate: string;
  lines: Omit<SurgeryDayStaffCostLine, "grossCostCents" | "hasWageProfile">[];
}): SurgeryDayStaffingCostSummary {
  const enriched: SurgeryDayStaffCostLine[] = input.lines.map((line) => ({
    ...line,
    hasWageProfile: line.baseRateCents > 0,
    grossCostCents: computeGrossLabourCostCents({
      rateType: line.rateType,
      baseRateCents: line.baseRateCents,
      minutesWorked: line.minutesWorked,
      awardLoadings: line.awardLoadings,
    }),
  }));

  return {
    workDate: input.workDate,
    shiftCount: enriched.length,
    staffedCount: enriched.filter((l) => l.hasWageProfile).length,
    missingProfileCount: enriched.filter((l) => !l.hasWageProfile).length,
    totalGrossCostCents: enriched.reduce((sum, l) => sum + l.grossCostCents, 0),
    lines: enriched,
  };
}

export function resolveAwardLoadingsForProfile(input: {
  awardCode: string | null;
  awardLoadingCodes: string[];
  placeholders: AwardLoadingPlaceholder[];
}): AwardLoadingSnapshot[] {
  const code = input.awardCode?.trim().toLowerCase();
  if (!code || input.awardLoadingCodes.length === 0) return [];

  const wanted = new Set(input.awardLoadingCodes.map((c) => c.trim().toLowerCase()));
  return input.placeholders
    .filter(
      (p) =>
        p.isActive &&
        p.awardCode.trim().toLowerCase() === code &&
        wanted.has(p.loadingCode.trim().toLowerCase())
    )
    .map((p) => ({
      loadingCode: p.loadingCode,
      displayName: p.displayName,
      multiplier: p.loadingMultiplier,
    }));
}

export function countWageProfilesByRateType(
  profiles: Pick<WorkforceWageProfile, "rateType" | "isActive">[]
): Record<WageRateType, number> {
  const out = Object.fromEntries(WAGE_RATE_TYPES.map((t) => [t, 0])) as Record<
    WageRateType,
    number
  >;
  for (const p of profiles) {
    if (!p.isActive) continue;
    out[p.rateType] += 1;
  }
  return out;
}