/**
 * WorkforceOS Phase 2E — roster command centre URL helpers (pure, testable).
 */

import type { WorkforceClinicalEventSource } from "@/src/lib/workforce-os/workforceClinicalEventMapping";
import type { ClinicalStaffingDisplayStatus } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";

export type RosterStaffingStatusFilter =
  | Exclude<ClinicalStaffingDisplayStatus, "not_configured">
  | "no_template";

export type RosterCommandCentreSearchParams = {
  dateFrom?: string;
  dateTo?: string;
  weekStart?: string;
  clinicId?: string;
  staffId?: string;
  eventType?: string;
  status?: RosterStaffingStatusFilter;
  eventSource?: WorkforceClinicalEventSource;
  eventId?: string;
  date?: string;
};

export type BuildRosterCommandCentreHrefInput = {
  tenantId: string;
  dateFrom?: string;
  dateTo?: string;
  weekStart?: string;
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
  const clinicId = trimOrUndefined(input.clinicId ?? undefined);
  const staffId = trimOrUndefined(input.staffId ?? undefined);
  const eventType = trimOrUndefined(input.eventType ?? undefined);
  const status = trimOrUndefined(input.status ?? undefined);
  const eventSource = trimOrUndefined(input.eventSource ?? undefined);
  const eventId = trimOrUndefined(input.eventId ?? undefined);
  const date = trimOrUndefined(input.date ?? undefined);

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

/** Default command centre window: current week Mon–Sun (UTC calendar). */
export function defaultRosterCommandCentreDateRange(now: Date = new Date()): {
  startsAt: string;
  endsAt: string;
  weekStart: string;
} {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    weekStart: start.toISOString().slice(0, 10),
  };
}

/** Resolve date range from weekStart query param (ISO date, Monday). */
export function rosterDateRangeFromWeekStart(weekStartIso: string): {
  startsAt: string;
  endsAt: string;
} {
  const start = new Date(`${weekStartIso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return defaultRosterCommandCentreDateRange();
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export function rosterDisplayStatusMatchesFilter(
  displayStatus: ClinicalStaffingDisplayStatus,
  filter: RosterStaffingStatusFilter
): boolean {
  if (filter === "no_template") return displayStatus === "not_configured";
  return displayStatus === filter;
}
