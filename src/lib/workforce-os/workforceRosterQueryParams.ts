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
  clinicId?: string;
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
  clinicId?: string | null;
  eventType?: string | null;
  status?: RosterStaffingStatusFilter | null;
  eventSource?: WorkforceClinicalEventSource | null;
  eventId?: string | null;
  date?: string | null;
};

function trimOrUndefined(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

/** Build `/fi-admin/[tenantId]/hr-os/roster` href with optional filters and event preselection. */
export function buildRosterCommandCentreHref(input: BuildRosterCommandCentreHrefInput): string {
  const base = `/fi-admin/${input.tenantId.trim()}/hr-os/roster`;
  const params = new URLSearchParams();

  const dateFrom = trimOrUndefined(input.dateFrom);
  const dateTo = trimOrUndefined(input.dateTo);
  const clinicId = trimOrUndefined(input.clinicId ?? undefined);
  const eventType = trimOrUndefined(input.eventType ?? undefined);
  const status = trimOrUndefined(input.status ?? undefined);
  const eventSource = trimOrUndefined(input.eventSource ?? undefined);
  const eventId = trimOrUndefined(input.eventId ?? undefined);
  const date = trimOrUndefined(input.date ?? undefined);

  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (clinicId) params.set("clinicId", clinicId);
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
    clinicId: pick("clinicId"),
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

/** Default command centre window: start of today through end of day +7 (UTC). */
export function defaultRosterCommandCentreDateRange(now: Date = new Date()): {
  startsAt: string;
  endsAt: string;
} {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 8);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export function rosterDisplayStatusMatchesFilter(
  displayStatus: ClinicalStaffingDisplayStatus,
  filter: RosterStaffingStatusFilter
): boolean {
  if (filter === "no_template") return displayStatus === "not_configured";
  return displayStatus === filter;
}
