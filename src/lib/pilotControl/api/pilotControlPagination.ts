/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — pagination / filter allowlists (pure).
 */

import { PilotControlApiError } from "./pilotControlApiErrors";
import type { PilotControlPagination } from "./pilotControlApiTypes";

export const PILOT_CONTROL_DEFAULT_PAGE_SIZE = 25;
export const PILOT_CONTROL_MAX_PAGE_SIZE = 100;
export const PILOT_CONTROL_MAX_SEARCH_LENGTH = 80;
export const PILOT_CONTROL_MAX_ACTIVITY_RANGE_DAYS = 31;
export const PILOT_CONTROL_MAX_EXPORT_ROWS = 500;
export const PILOT_CONTROL_DEFAULT_CONCURRENCY = 4;

export const PILOT_PATIENT_REGISTER_SORTS = [
  "updated_at",
  "display_name",
  "pilot_status",
  "overall_readiness",
  "blocker_severity",
  "last_activity_at",
] as const;

export type PilotPatientRegisterSort = (typeof PILOT_PATIENT_REGISTER_SORTS)[number];

export const PILOT_BLOCKER_SORTS = ["severity", "age", "last_confirmed_at"] as const;
export type PilotBlockerSort = (typeof PILOT_BLOCKER_SORTS)[number];

export const PILOT_SORT_DIRECTIONS = ["asc", "desc"] as const;
export type PilotSortDirection = (typeof PILOT_SORT_DIRECTIONS)[number];

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  attention: 2,
  info: 3,
};

export function parsePagination(
  raw: { page?: string | null; pageSize?: string | null },
  correlationId: string,
  options?: { required?: boolean }
): { page: number; pageSize: number } {
  const pageRaw = raw.page?.trim();
  const sizeRaw = raw.pageSize?.trim();

  if (options?.required && (pageRaw == null || pageRaw === "" || sizeRaw == null || sizeRaw === "")) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_PAGINATION",
      "page and pageSize are required.",
      400,
      correlationId
    );
  }

  const page = pageRaw ? Number(pageRaw) : 1;
  const pageSize = sizeRaw ? Number(sizeRaw) : PILOT_CONTROL_DEFAULT_PAGE_SIZE;

  if (!Number.isInteger(page) || page < 1) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_PAGINATION",
      "page must be a positive integer.",
      400,
      correlationId
    );
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_PAGINATION",
      "pageSize must be a positive integer.",
      400,
      correlationId
    );
  }
  if (pageSize > PILOT_CONTROL_MAX_PAGE_SIZE) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_PAGINATION",
      `pageSize must not exceed ${PILOT_CONTROL_MAX_PAGE_SIZE}.`,
      400,
      correlationId
    );
  }

  return { page, pageSize };
}

export function buildPagination(args: {
  page: number;
  pageSize: number;
  total: number;
}): PilotControlPagination {
  const totalPages = args.total === 0 ? 0 : Math.ceil(args.total / args.pageSize);
  return {
    page: args.page,
    pageSize: args.pageSize,
    total: args.total,
    totalPages,
    hasNextPage: args.page < totalPages,
    hasPreviousPage: args.page > 1 && totalPages > 0,
  };
}

export function parseAllowlistedSort<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[],
  defaultSort: T,
  correlationId: string
): T {
  if (raw == null || raw.trim() === "") return defaultSort;
  const value = raw.trim() as T;
  if (!allowed.includes(value)) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_FILTER",
      `sort must be one of: ${allowed.join(", ")}.`,
      400,
      correlationId
    );
  }
  return value;
}

export function parseSortDirection(
  raw: string | null | undefined,
  correlationId: string,
  defaultDirection: PilotSortDirection = "asc"
): PilotSortDirection {
  if (raw == null || raw.trim() === "") return defaultDirection;
  const value = raw.trim().toLowerCase();
  if (value !== "asc" && value !== "desc") {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_FILTER",
      "direction must be asc or desc.",
      400,
      correlationId
    );
  }
  return value;
}

export function parseSearch(
  raw: string | null | undefined,
  correlationId: string
): string | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const s = raw.trim();
  if (s.length > PILOT_CONTROL_MAX_SEARCH_LENGTH) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_FILTER",
      `search must be at most ${PILOT_CONTROL_MAX_SEARCH_LENGTH} characters.`,
      400,
      correlationId
    );
  }
  return s;
}

/**
 * Activity date range — bounded. Default max = PILOT_CONTROL_MAX_ACTIVITY_RANGE_DAYS.
 */
export function parseBoundedDateRange(
  args: { from?: string | null; to?: string | null; maxDays?: number },
  correlationId: string
): { from: string; to: string } {
  const maxDays = args.maxDays ?? PILOT_CONTROL_MAX_ACTIVITY_RANGE_DAYS;
  const now = Date.now();
  const toMs = args.to?.trim() ? Date.parse(args.to.trim()) : now;
  const fromMs = args.from?.trim()
    ? Date.parse(args.from.trim())
    : toMs - maxDays * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_FILTER",
      "from and to must be valid ISO timestamps.",
      400,
      correlationId
    );
  }
  if (fromMs > toMs) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_FILTER",
      "from must be before to.",
      400,
      correlationId
    );
  }
  const spanDays = (toMs - fromMs) / (24 * 60 * 60 * 1000);
  if (spanDays > maxDays) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_DATE_RANGE_TOO_WIDE",
      `Date range must not exceed ${maxDays} days.`,
      400,
      correlationId
    );
  }
  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() };
}

/** Critical → high → attention → info, then oldest first within severity. */
export function compareBlockersBySeverityThenAge(
  a: { severity: string; ageSeconds?: number; firstDetectedAt?: string },
  b: { severity: string; ageSeconds?: number; firstDetectedAt?: string }
): number {
  const ra = SEVERITY_RANK[a.severity] ?? 99;
  const rb = SEVERITY_RANK[b.severity] ?? 99;
  if (ra !== rb) return ra - rb;
  const ageA = a.ageSeconds ?? 0;
  const ageB = b.ageSeconds ?? 0;
  if (ageA !== ageB) return ageB - ageA; // oldest first = larger age first
  const fa = a.firstDetectedAt ?? "";
  const fb = b.firstDetectedAt ?? "";
  return fa < fb ? -1 : fa > fb ? 1 : 0;
}

export function severityRank(severity: string): number {
  return SEVERITY_RANK[severity] ?? 99;
}
