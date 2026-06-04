import { isAllowedPatientStatus, type PatientStatusValue } from "./patientPolicy";

export type PatientDirectorySort = "created_desc" | "created_asc";

export type PatientDirectoryQuery = {
  search: string;
  patientStatus: PatientStatusValue | null;
  hasActiveCase: boolean | null;
  hasFutureBooking: boolean | null;
  sort: PatientDirectorySort;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 25;

function firstString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function parseBool(v: string | undefined): boolean | null {
  if (v == null || v === "") return null;
  const x = v.trim().toLowerCase();
  if (x === "1" || x === "true" || x === "yes") return true;
  if (x === "0" || x === "false" || x === "no") return false;
  return null;
}

function parsePage(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parsePageSize(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_PAGE_SIZE;
  return Math.min(100, Math.max(5, Math.floor(n)));
}

/**
 * Parse FI Admin patient directory URL search params (pure).
 */
export function parsePatientDirectoryQuery(
  searchParams: Record<string, string | string[] | undefined> | undefined
): PatientDirectoryQuery {
  const sp = searchParams ?? {};
  const statusRaw = firstString(sp.status)?.trim().toLowerCase();
  const patientStatus = statusRaw && isAllowedPatientStatus(statusRaw) ? statusRaw : null;

  const sortRaw = firstString(sp.sort)?.trim();
  const sort: PatientDirectorySort =
    sortRaw === "created_asc" || sortRaw === "created_desc" ? sortRaw : "created_desc";

  return {
    search: (firstString(sp.q) ?? "").trim(),
    patientStatus,
    hasActiveCase: parseBool(firstString(sp.hasActiveCase)),
    hasFutureBooking: parseBool(firstString(sp.hasFutureBooking)),
    sort,
    page: parsePage(firstString(sp.page)),
    pageSize: parsePageSize(firstString(sp.pageSize)),
  };
}

export function patientDirectoryQueryToHrefQuery(q: PatientDirectoryQuery): Record<string, string> {
  const out: Record<string, string> = {};
  if (q.search) out.q = q.search;
  if (q.patientStatus) out.status = q.patientStatus;
  if (q.hasActiveCase === true) out.hasActiveCase = "true";
  if (q.hasActiveCase === false) out.hasActiveCase = "false";
  if (q.hasFutureBooking === true) out.hasFutureBooking = "true";
  if (q.hasFutureBooking === false) out.hasFutureBooking = "false";
  if (q.sort !== "created_desc") out.sort = q.sort;
  if (q.page > 1) out.page = String(q.page);
  if (q.pageSize !== DEFAULT_PAGE_SIZE) out.pageSize = String(q.pageSize);
  return out;
}

export function buildPatientDirectoryHref(tenantId: string, q: PatientDirectoryQuery): string {
  const tid = tenantId.trim();
  const params = new URLSearchParams(patientDirectoryQueryToHrefQuery(q));
  const qs = params.toString();
  return qs ? `/fi-admin/${tid}/patients?${qs}` : `/fi-admin/${tid}/patients`;
}
