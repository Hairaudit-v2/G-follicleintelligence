import {
  resolveRosterPeriodStart,
  rosterDateRangeFromPeriodStart,
  type RosterCadence,
  type RosterWeekStartDay,
} from "@/src/lib/workforce/rosterCadencePolicyCore";
import { mondayOfWeekIso } from "@/src/lib/workforce-os/staffStandardHoursCore";
import type { WorkforceClinicalEventSource } from "@/src/lib/workforce-os/workforceClinicalEventMapping";
import type { ClinicalStaffingDisplayStatus } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";

export type RosterStaffingStatusFilter =
  | Exclude<ClinicalStaffingDisplayStatus, "not_configured">
  | "no_template";

export type RosterCommandCentreSearchParams = {
  dateFrom?: string;
  dateTo?: string;
  weekStart?: string;
  periodStart?: string;
  monthStart?: string;
  clinicId?: string;
  staffId?: string;
  eventType?: string;
  status?: RosterStaffingStatusFilter;
  eventSource?: WorkforceClinicalEventSource;
  eventId?: string;
  date?: string;
};

export type RosterPlanningContext = {
  rosterCadence: RosterCadence;
  rosterWeekStartDay: RosterWeekStartDay;
  rosterCycleAnchorDate: string;
  explicitlyConfigured: boolean;
};

export type BuildRosterCommandCentreHrefInput = {
  tenantId: string;
  dateFrom?: string;
  dateTo?: string;
  weekStart?: string;
  periodStart?: string;
  monthStart?: string;
  clinicId?: string | null;
  staffId?: string | null;
  eventType?: string | null;
  status?: RosterStaffingStatusFilter | null;
  eventSource?: WorkforceClinicalEventSource | null;
  eventId?: string | null;
  date?: string | null;
  /** When set, roster href uses workforce-os route instead of hr-os. */
  useWorkforceOsRoute?: boolean;
};

function trimOrUndefined(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

/** Build roster command centre href with optional filters and event preselection. */
export function buildRosterCommandCentreHref(input: BuildRosterCommandCentreHrefInput): string {
  const base = input.useWorkforceOsRoute
    ? `/fi-admin/${input.tenantId.trim()}/workforce-os/roster`
    : `/fi-admin/${input.tenantId.trim()}/hr-os/roster`;
  const params = new URLSearchParams();

  const dateFrom = trimOrUndefined(input.dateFrom);
  const dateTo = trimOrUndefined(input.dateTo);
  const weekStart = trimOrUndefined(input.weekStart);
  const periodStart = trimOrUndefined(input.periodStart);
  const monthStart = trimOrUndefined(input.monthStart);
  const clinicId = trimOrUndefined(input.clinicId ?? undefined);
  const staffId = trimOrUndefined(input.staffId ?? undefined);
  const eventType = trimOrUndefined(input.eventType ?? undefined);
  const status = trimOrUndefined(input.status ?? undefined);
  const eventSource = trimOrUndefined(input.eventSource ?? undefined);
  const eventId = trimOrUndefined(input.eventId ?? undefined);
  const date = trimOrUndefined(input.date ?? undefined);

  if (periodStart) params.set("periodStart", periodStart);
  if (monthStart) params.set("monthStart", monthStart);
  if (weekStart) params.set("weekStart", weekStart);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (clinicId) params.set("clinicId", clinicId);
  if (staffId) params.set("staffId", staffId);
  if (eventType) params.set("eventType", eventType);
  if (status) params.set("status", status);
  if (eventSource) params.set("eventSource", eventSource);
  if (eventId) params.set("eventId", eventId);
  if (date) params.set("date", date);

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function parseRosterCommandCentreSearchParams(
  raw: Record<string, string | string[] | undefined> | RosterCommandCentreSearchParams
): RosterCommandCentreSearchParams {
  const pick = (key: keyof RosterCommandCentreSearchParams): string | undefined => {
    const value = raw[key];
    if (Array.isArray(value)) return trimOrUndefined(value[0]);
    return trimOrUndefined(value);
  };

  const statusRaw = pick("status");
  const allowedStatuses = new Set<RosterStaffingStatusFilter>([
    "ready",
    "missing_roles",
    "warning",
    "blocked",
    "no_template",
  ]);
  const status =
    statusRaw && allowedStatuses.has(statusRaw as RosterStaffingStatusFilter)
      ? (statusRaw as RosterStaffingStatusFilter)
      : undefined;

  const eventSourceRaw = pick("eventSource");
  const allowedSources = new Set<WorkforceClinicalEventSource>([
    "booking",
    "surgery",
    "calendar",
    "manual",
  ]);
  const eventSource =
    eventSourceRaw && allowedSources.has(eventSourceRaw as WorkforceClinicalEventSource)
      ? (eventSourceRaw as WorkforceClinicalEventSource)
      : undefined;

  return {
    dateFrom: pick("dateFrom"),
    dateTo: pick("dateTo"),
    weekStart: pick("weekStart"),
    periodStart: pick("periodStart"),
    monthStart: pick("monthStart"),
    clinicId: pick("clinicId"),
    staffId: pick("staffId"),
    eventType: pick("eventType"),
    status,
    eventSource,
    eventId: pick("eventId"),
    date: pick("date"),
  };
}

/** Resolve preselected event key from query params (`eventSource:eventId`). */
export function resolveRosterPreselectedEventKey(
  params: Pick<RosterCommandCentreSearchParams, "eventSource" | "eventId">
): string | null {
  const source = params.eventSource?.trim();
  const id = params.eventId?.trim();
  if (!source || !id) return null;
  return `${source}:${id}`;
}

/** Default command centre window: current period for cadence (weekly Mon–Sun by default). */
export function defaultRosterCommandCentreDateRange(
  now: Date = new Date(),
  planning: Pick<
    RosterPlanningContext,
    "rosterCadence" | "rosterWeekStartDay" | "rosterCycleAnchorDate"
  > = {
    rosterCadence: "weekly",
    rosterWeekStartDay: "monday",
    rosterCycleAnchorDate: "2026-01-05",
  }
): {
  startsAt: string;
  endsAt: string;
  periodStart: string;
  periodDayDates: string[];
  /** @deprecated Use periodStart — kept for weekly back-compat URLs. */
  weekStart: string;
} {
  const ref = now.toISOString().slice(0, 10);
  const periodStart = resolveRosterPeriodStart({
    refDateIso: ref,
    cadence: planning.rosterCadence,
    weekStartDay: planning.rosterWeekStartDay,
    rosterCycleAnchorDate: planning.rosterCycleAnchorDate,
  });
  const range = rosterDateRangeFromPeriodStart(
    periodStart,
    planning.rosterCadence,
    planning.rosterWeekStartDay
  );
  return {
    startsAt: range.startsAt,
    endsAt: range.endsAt,
    periodStart: range.periodStart,
    periodDayDates: range.periodDayDates,
    weekStart:
      planning.rosterCadence === "monthly"
        ? mondayOfWeekIso(ref)
        : range.periodStart,
  };
}

/** Resolve date range from period start query param. */
export function rosterDateRangeFromPeriodStartParam(
  periodStartIso: string,
  planning: Pick<RosterPlanningContext, "rosterCadence" | "rosterWeekStartDay">
): {
  startsAt: string;
  endsAt: string;
  periodStart: string;
  periodDayDates: string[];
} {
  return rosterDateRangeFromPeriodStart(
    periodStartIso,
    planning.rosterCadence,
    planning.rosterWeekStartDay
  );
}

/** Resolve date range from weekStart query param (ISO date, Monday). */
export function rosterDateRangeFromWeekStart(weekStartIso: string): {
  startsAt: string;
  endsAt: string;
} {
  return rosterDateRangeFromPeriodStartParam(weekStartIso, {
    rosterCadence: "weekly",
    rosterWeekStartDay: "monday",
  });
}

export function resolveRosterPeriodStartFromParams(
  params: Pick<RosterCommandCentreSearchParams, "weekStart" | "periodStart" | "monthStart">,
  planning: Pick<
    RosterPlanningContext,
    "rosterCadence" | "rosterWeekStartDay" | "rosterCycleAnchorDate"
  >
): string {
  if (planning.rosterCadence === "monthly") {
    const month = params.monthStart ?? params.periodStart ?? params.weekStart;
    if (month) return `${month.slice(0, 7)}-01`;
  }
  const explicit = params.periodStart ?? params.weekStart;
  if (explicit) return explicit.slice(0, 10);
  return defaultRosterCommandCentreDateRange(new Date(), planning).periodStart;
}

export function rosterDisplayStatusMatchesFilter(
  displayStatus: ClinicalStaffingDisplayStatus,
  filter: RosterStaffingStatusFilter
): boolean {
  if (filter === "no_template") return displayStatus === "not_configured";
  return displayStatus === filter;
}
