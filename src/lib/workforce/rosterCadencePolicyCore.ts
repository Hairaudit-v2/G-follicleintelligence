/**
 * WorkforceOS — per-tenant roster planning cadence (pure parse/merge + date helpers).
 */

import { mondayOfWeekIso, isoDateForWeekday } from "@/src/lib/workforce-os/staffStandardHoursCore";
import type { ClinicDeploymentTemplateCode } from "@/src/lib/onboarding-os/tenantProvisioningTypes";

export type RosterCadence = "weekly" | "fortnightly" | "monthly";
export type RosterWeekStartDay = "monday" | "sunday";
export type RosterGenerationMode =
  | "standard_hours_only"
  | "copy_previous_period"
  | "hybrid";
export type DefaultFullTimePattern = "five_eight" | "four_ten" | "custom";

export type WorkforceRosterPlanningPolicy = {
  rosterCadence: RosterCadence;
  rosterWeekStartDay: RosterWeekStartDay;
  rosterPlanningHorizonWeeks: number;
  rosterPublishRequired: boolean;
  rosterGenerationMode: RosterGenerationMode;
  defaultShiftLengthHours: number | null;
  defaultFullTimePattern: DefaultFullTimePattern;
  /** Fortnightly anchor (YYYY-MM-DD) — start of Week A. */
  rosterCycleAnchorDate: string;
  /** True when `workforce_roster_planning` exists in tenant metadata. */
  explicitlyConfigured: boolean;
};

export const ROSTER_CADENCE_VALUES: readonly RosterCadence[] = [
  "weekly",
  "fortnightly",
  "monthly",
];

export const DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY: Omit<
  WorkforceRosterPlanningPolicy,
  "explicitlyConfigured"
> = {
  rosterCadence: "weekly",
  rosterWeekStartDay: "monday",
  rosterPlanningHorizonWeeks: 4,
  rosterPublishRequired: false,
  rosterGenerationMode: "standard_hours_only",
  defaultShiftLengthHours: null,
  defaultFullTimePattern: "five_eight",
  rosterCycleAnchorDate: "2026-01-05",
};

const METADATA_KEY = "workforce_roster_planning";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseBooleanFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return null;
}

function parseIsoDate(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function parseCadence(value: unknown): RosterCadence {
  const raw = String(value ?? "").trim().toLowerCase();
  return ROSTER_CADENCE_VALUES.includes(raw as RosterCadence)
    ? (raw as RosterCadence)
    : DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY.rosterCadence;
}

function parseWeekStartDay(value: unknown): RosterWeekStartDay {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "sunday" ? "sunday" : "monday";
}

function parseGenerationMode(value: unknown): RosterGenerationMode {
  const raw = String(value ?? "").trim().toLowerCase();
  const allowed: RosterGenerationMode[] = [
    "standard_hours_only",
    "copy_previous_period",
    "hybrid",
  ];
  return allowed.includes(raw as RosterGenerationMode)
    ? (raw as RosterGenerationMode)
    : DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY.rosterGenerationMode;
}

function parseFullTimePattern(value: unknown): DefaultFullTimePattern {
  const raw = String(value ?? "").trim().toLowerCase();
  const allowed: DefaultFullTimePattern[] = ["five_eight", "four_ten", "custom"];
  return allowed.includes(raw as DefaultFullTimePattern)
    ? (raw as DefaultFullTimePattern)
    : DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY.defaultFullTimePattern;
}

function parseHorizonWeeks(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY.rosterPlanningHorizonWeeks;
  return Math.min(52, Math.max(1, Math.floor(n)));
}

function parseShiftLengthHours(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(24, n);
}

/** Reads `metadata.workforce_roster_planning` from fi_tenant_settings. */
export function parseWorkforceRosterPlanningPolicy(
  metadata: Record<string, unknown> | null | undefined
): WorkforceRosterPlanningPolicy {
  const root = asObject(metadata?.[METADATA_KEY]);
  const explicitlyConfigured = root != null;

  if (!root) {
    return {
      ...DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY,
      explicitlyConfigured: false,
    };
  }

  return {
    rosterCadence: parseCadence(root.roster_cadence ?? root.rosterCadence),
    rosterWeekStartDay: parseWeekStartDay(
      root.roster_week_start_day ?? root.rosterWeekStartDay
    ),
    rosterPlanningHorizonWeeks: parseHorizonWeeks(
      root.roster_planning_horizon_weeks ?? root.rosterPlanningHorizonWeeks
    ),
    rosterPublishRequired:
      parseBooleanFlag(root.roster_publish_required) ??
      parseBooleanFlag(root.rosterPublishRequired) ??
      DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY.rosterPublishRequired,
    rosterGenerationMode: parseGenerationMode(
      root.roster_generation_mode ?? root.rosterGenerationMode
    ),
    defaultShiftLengthHours: parseShiftLengthHours(
      root.default_shift_length_hours ?? root.defaultShiftLengthHours
    ),
    defaultFullTimePattern: parseFullTimePattern(
      root.default_full_time_pattern ?? root.defaultFullTimePattern
    ),
    rosterCycleAnchorDate: parseIsoDate(
      root.roster_cycle_anchor_date ?? root.rosterCycleAnchorDate,
      DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY.rosterCycleAnchorDate
    ),
    explicitlyConfigured,
  };
}

export function isRosterCadenceConfigured(
  policy: WorkforceRosterPlanningPolicy
): boolean {
  return policy.explicitlyConfigured;
}

/** Merges policy into tenant settings metadata without dropping unrelated keys. */
export function mergeWorkforceRosterPlanningPolicyIntoMetadata(
  metadata: Record<string, unknown> | null | undefined,
  policy: Partial<
    Omit<WorkforceRosterPlanningPolicy, "explicitlyConfigured">
  >
): Record<string, unknown> {
  const base = asObject(metadata) ?? {};
  const existing = asObject(base[METADATA_KEY]) ?? {};
  const current = parseWorkforceRosterPlanningPolicy(base);
  const merged = {
    ...current,
    ...policy,
    explicitlyConfigured: true as const,
  };

  return {
    ...base,
    [METADATA_KEY]: {
      ...existing,
      roster_cadence: merged.rosterCadence,
      roster_week_start_day: merged.rosterWeekStartDay,
      roster_planning_horizon_weeks: merged.rosterPlanningHorizonWeeks,
      roster_publish_required: merged.rosterPublishRequired,
      roster_generation_mode: merged.rosterGenerationMode,
      default_shift_length_hours: merged.defaultShiftLengthHours,
      default_full_time_pattern: merged.defaultFullTimePattern,
      roster_cycle_anchor_date: merged.rosterCycleAnchorDate,
    },
  };
}

/** Onboarding deployment template → suggested roster planning defaults. */
export function defaultRosterPlanningPolicyForDeploymentTemplate(
  templateCode: ClinicDeploymentTemplateCode | string | null | undefined
): Omit<WorkforceRosterPlanningPolicy, "explicitlyConfigured"> {
  const code = String(templateCode ?? "").trim();
  switch (code) {
    case "surgical_hair_restoration":
      return {
        ...DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY,
        rosterCadence: "fortnightly",
        rosterCycleAnchorDate: "2026-01-05",
      };
    case "enterprise_multi_clinic":
      return {
        ...DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY,
        rosterCadence: "monthly",
        rosterPlanningHorizonWeeks: 8,
      };
    case "standard_hair_restoration":
    case "growth_consultation":
    default:
      return { ...DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY };
  }
}

function shiftIsoDate(isoDate: string, dayDelta: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dayDelta);
  return d.toISOString().slice(0, 10);
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const start = new Date(`${startIso.slice(0, 10)}T12:00:00.000Z`);
  const end = new Date(`${endIso.slice(0, 10)}T12:00:00.000Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export type ResolveRosterPeriodStartInput = {
  refDateIso: string;
  cadence: RosterCadence;
  weekStartDay?: RosterWeekStartDay;
  rosterCycleAnchorDate?: string;
};

/** Week-aligned period start for the cadence containing `refDateIso`. */
export function resolveRosterPeriodStart(input: ResolveRosterPeriodStartInput): string {
  const ref = input.refDateIso.slice(0, 10);
  const weekStartDay = input.weekStartDay ?? "monday";

  if (input.cadence === "monthly") {
    return `${ref.slice(0, 7)}-01`;
  }

  const weekStart =
    weekStartDay === "sunday" ? sundayOfWeekIso(ref) : mondayOfWeekIso(ref);

  if (input.cadence === "weekly") return weekStart;

  const anchorMonday = mondayOfWeekIso(
    (input.rosterCycleAnchorDate ?? DEFAULT_WORKFORCE_ROSTER_PLANNING_POLICY.rosterCycleAnchorDate).slice(
      0,
      10
    )
  );
  const weeksFromAnchor = Math.floor(daysBetweenIso(anchorMonday, weekStart) / 7);
  const fortnightOffset = weeksFromAnchor % 2 === 0 ? 0 : -7;
  return shiftIsoDate(weekStart, fortnightOffset);
}

function sundayOfWeekIso(refDateIso: string): string {
  const d = new Date(`${refDateIso.slice(0, 10)}T12:00:00.000Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Inclusive period day count for cadence (weekly=7, fortnightly=14, monthly=calendar days). */
export function rosterPeriodDayCount(
  periodStartIso: string,
  cadence: RosterCadence
): number {
  if (cadence === "weekly") return 7;
  if (cadence === "fortnightly") return 14;
  const [y, m] = periodStartIso.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** UTC ISO range `[startsAt, endsAt)` for roster generation queries. */
export function rosterDateRangeFromPeriodStart(
  periodStartIso: string,
  cadence: RosterCadence,
  weekStartDay: RosterWeekStartDay = "monday"
): { startsAt: string; endsAt: string; periodStart: string; periodDayDates: string[] } {
  const periodStart = periodStartIso.slice(0, 10);
  const dayCount = rosterPeriodDayCount(periodStart, cadence);
  const periodDayDates = Array.from({ length: dayCount }, (_, i) =>
    shiftIsoDate(periodStart, i)
  );

  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + dayCount);

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    periodStart,
    periodDayDates,
  };
}

/** Fortnightly cycle week index (1=Week A, 2=Week B) for a local calendar date. */
export function resolveFortnightCycleWeek(
  localDate: string,
  anchorDate: string
): 1 | 2 {
  const anchorWeekStart = mondayOfWeekIso(anchorDate.slice(0, 10));
  const dateWeekStart = mondayOfWeekIso(localDate.slice(0, 10));
  const weeksSinceAnchor = Math.floor(daysBetweenIso(anchorWeekStart, dateWeekStart) / 7);
  return weeksSinceAnchor % 2 === 0 ? 1 : 2;
}

/** Shift period navigation (prev/next) for week / fortnight / month. */
export function shiftRosterPeriodStart(
  periodStartIso: string,
  cadence: RosterCadence,
  direction: -1 | 1
): string {
  const start = periodStartIso.slice(0, 10);
  if (cadence === "weekly") return shiftIsoDate(start, direction * 7);
  if (cadence === "fortnightly") return shiftIsoDate(start, direction * 14);

  const [y, m] = start.slice(0, 7).split("-").map(Number);
  const nextMonth = new Date(Date.UTC(y, m - 1 + direction, 1));
  const yyyy = nextMonth.getUTCFullYear();
  const mm = String(nextMonth.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

/** Group month day dates into week rows for grid display. */
export function groupDatesIntoWeekRows(
  dayDates: string[],
  weekStartDay: RosterWeekStartDay = "monday"
): string[][] {
  if (!dayDates.length) return [];
  const rows: string[][] = [];
  let current: string[] = [];

  for (const date of dayDates) {
    const d = new Date(`${date}T12:00:00.000Z`);
    const dow = d.getUTCDay();
    const isWeekStart =
      weekStartDay === "sunday" ? dow === 0 : dow === 1;

    if (isWeekStart && current.length) {
      rows.push(current);
      current = [];
    }
    current.push(date);
  }
  if (current.length) rows.push(current);
  return rows;
}

export function rosterCadencePeriodLabel(cadence: RosterCadence): string {
  switch (cadence) {
    case "fortnightly":
      return "fortnight";
    case "monthly":
      return "month";
    default:
      return "week";
  }
}

export function rosterGenerateActionLabel(cadence: RosterCadence): string {
  switch (cadence) {
    case "fortnightly":
      return "Generate fortnight";
    case "monthly":
      return "Generate month";
    default:
      return "Generate week";
  }
}

export function rosterCopyPreviousActionLabel(cadence: RosterCadence): string {
  switch (cadence) {
    case "fortnightly":
      return "Copy previous fortnight";
    case "monthly":
      return "Copy previous month";
    default:
      return "Copy previous week";
  }
}

export function fortnightWeekLabel(
  localDate: string,
  anchorDate: string
): "Week A" | "Week B" {
  return resolveFortnightCycleWeek(localDate, anchorDate) === 1 ? "Week A" : "Week B";
}

/** Week row labels for fortnightly grid headers. */
export function fortnightWeekRowLabels(
  periodDayDates: string[],
  anchorDate: string
): Map<string, "Week A" | "Week B"> {
  const out = new Map<string, "Week A" | "Week B">();
  for (const date of periodDayDates) {
    out.set(date, fortnightWeekLabel(date, anchorDate));
  }
  return out;
}

export { isoDateForWeekday, mondayOfWeekIso };
