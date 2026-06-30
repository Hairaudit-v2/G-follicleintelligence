import {
  buildCasesWorklistQueryString,
  parseCasesIndexQuery,
} from "@/src/lib/cases/casesIndexFilters";

/** Keys allowed when round-tripping the cases worklist through `fromCases` (prevents open redirects / junk). */
const FROM_CASES_ALLOWED = [
  "q",
  "status",
  "treatment_type",
  "case_type",
  "planning_status",
  "procedure_status",
  "post_op_status",
  "readiness",
  "sort",
  "page",
  "pageSize",
] as const;

/**
 * Reads optional `fromCases` search param (URL-encoded cases index query string), parses and re-serializes safely.
 */
export function sanitizeFromCasesSearchParam(
  raw: string | string[] | undefined
): string | undefined {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s?.trim()) return undefined;
  try {
    const decoded = decodeURIComponent(s.trim());
    if (decoded.length > 4096) return undefined;
    const incoming = new URLSearchParams(decoded.startsWith("?") ? decoded.slice(1) : decoded);
    const sp: Record<string, string | string[] | undefined> = {};
    for (const key of FROM_CASES_ALLOWED) {
      const v = incoming.get(key);
      if (v != null && v !== "") sp[key] = v;
    }
    const q = parseCasesIndexQuery(sp);
    const out = buildCasesWorklistQueryString(q);
    return out || undefined;
  } catch {
    return undefined;
  }
}

export function caseDetailCasesListHref(tenantId: string, returnQueryString?: string): string {
  const base = `/fi-admin/${tenantId.trim()}/cases`;
  return returnQueryString ? `${base}?${returnQueryString}` : base;
}

export function caseDetailPageHref(
  tenantId: string,
  caseId: string,
  casesListReturnQuery?: string
): string {
  const base = `/fi-admin/${tenantId.trim()}/cases/${caseId.trim()}`;
  if (!casesListReturnQuery) return base;
  return `${base}?fromCases=${encodeURIComponent(casesListReturnQuery)}`;
}

/** Read-only case summary / print view (Stage 5J). */
export function caseSummaryDocumentPageHref(
  tenantId: string,
  caseId: string,
  casesListReturnQuery?: string
): string {
  const base = `/fi-admin/${tenantId.trim()}/cases/${caseId.trim()}/summary`;
  if (!casesListReturnQuery) return base;
  return `${base}?fromCases=${encodeURIComponent(casesListReturnQuery)}`;
}
