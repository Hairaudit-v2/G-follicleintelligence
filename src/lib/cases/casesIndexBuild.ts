import type { CaseAdminDetail, CaseBookingListItem, CaseImageListItem, CaseIndexRow } from "@/src/lib/cases/caseLoaders";
import { buildCaseReadiness } from "@/src/lib/cases/caseReadinessBuild";
import type { CasesIndexExtensionBundle } from "@/src/lib/cases/casesIndexLoaders";
import type { CaseReadinessReport } from "@/src/lib/cases/caseReadinessTypes";
import type { CaseWorklistRow, CasesIndexFilterOptions, CasesIndexQuery, CasesIndexPageSize, CasesWorklistReadinessBucket } from "./casesIndexTypes";
import { CASES_INDEX_NONE_VALUE } from "./casesIndexTypes";

function stubBookings(n: number): CaseBookingListItem[] {
  const ts = new Date(0).toISOString();
  return Array.from({ length: n }, (_, i) => ({
    id: `idx-booking-${i}`,
    booking_type: "case",
    booking_status: "unknown",
    title: null,
    start_at: ts,
    end_at: ts,
  }));
}

function stubImages(n: number): CaseImageListItem[] {
  const ts = new Date(0).toISOString();
  return Array.from({ length: n }, (_, i) => ({
    id: `idx-image-${i}`,
    image_category: "other",
    image_status: "active",
    caption: null,
    storage_path: `stub/${i}`,
    created_at: ts,
  }));
}

/**
 * Minimal `CaseAdminDetail` used only to run `buildCaseReadiness` for the worklist (image/booking counts preserved).
 */
export function buildAdminDetailStubForWorklistReadiness(
  tenantId: string,
  row: CaseIndexRow,
  imageCount: number,
  bookingCount: number
): CaseAdminDetail {
  return {
    id: row.id,
    tenant_id: tenantId,
    status: row.status,
    treatment_type: row.treatment_type,
    case_type: row.case_type,
    planning_notes: null,
    external_id: row.external_id,
    foundation_patient_id: row.foundation_patient_id,
    legacy_patient_id: row.legacy_patient_id,
    clinic_id: null,
    organisation_id: null,
    partner_id: null,
    metadata: {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    patient:
      row.foundation_patient_id || row.legacy_patient_id
        ? {
            foundation_patient_id: row.foundation_patient_id ?? row.legacy_patient_id ?? "",
            person_id: "",
            person_label: row.person_label,
            person_email: row.person_email,
          }
        : null,
    leads: row.lead
      ? [{ id: row.lead.id, title: row.lead.title, link_reason: "case_id", status: "" }]
      : [],
    bookings: stubBookings(bookingCount),
    images: stubImages(imageCount),
  };
}

function readinessBucketFromReport(r: CaseReadinessReport): CasesWorklistReadinessBucket {
  if (r.sections.every((s) => s.health === "complete")) return "ready";
  if (r.sections.some((s) => s.health === "needs_attention")) return "needs_attention";
  return "in_progress";
}

/**
 * Merges index rows with extension bundle and computes worklist readiness (timeline omitted).
 */
export function buildCaseWorklistRows(
  tenantId: string,
  baseRows: CaseIndexRow[],
  ext: CasesIndexExtensionBundle
): CaseWorklistRow[] {
  const tid = tenantId.trim();
  return baseRows.map((row) => {
    const imageCount = ext.imageCountByCaseId.get(row.id) ?? 0;
    const bookingCount = ext.bookingCountByCaseId.get(row.id) ?? 0;
    const surgeryPlan = ext.plansByCaseId.get(row.id) ?? null;
    const procedureDay = ext.proceduresByCaseId.get(row.id) ?? null;
    const postOpTracking = ext.postOpByCaseId.get(row.id) ?? null;
    const followUps = ext.followUpsByCaseId.get(row.id) ?? [];
    const detail = buildAdminDetailStubForWorklistReadiness(tid, row, imageCount, bookingCount);
    const readiness = buildCaseReadiness(
      {
        detail,
        surgeryPlan,
        procedureDay,
        postOpTracking,
        followUps,
        timelineItems: [],
      },
      { worklistMode: true }
    );
    const procedureDate = procedureDay?.procedure_date?.trim()
      ? procedureDay.procedure_date.trim().slice(0, 10)
      : null;
    return {
      ...row,
      tenant_id: tid,
      imageCount,
      bookingCount,
      surgeryPlan,
      procedureDay,
      postOpTracking,
      followUps,
      readinessPercent: readiness.overallPercent,
      readinessBucket: readinessBucketFromReport(readiness),
      readinessNeedsAttention: readiness.sections.some((s) => s.health === "needs_attention"),
      procedureDate,
    };
  });
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function matchesSearch(row: CaseWorklistRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const parts = [
    row.id,
    row.external_id ?? "",
    row.person_label,
    row.person_email ?? "",
    row.lead?.title ?? "",
    row.treatment_type ?? "",
    row.case_type ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (parts.includes(needle)) return true;
  if (row.id.toLowerCase().includes(needle)) return true;
  return false;
}

/**
 * Applies URL query filters in-memory (no extra DB round-trips).
 */
export function applyCasesWorklistFilters(rows: CaseWorklistRow[], query: CasesIndexQuery): CaseWorklistRow[] {
  return rows.filter((row) => {
    if (!matchesSearch(row, query.q)) return false;
    if (query.status && norm(row.status) !== norm(query.status)) return false;
    if (query.treatment_type && norm(row.treatment_type) !== norm(query.treatment_type)) return false;
    if (query.case_type && norm(row.case_type) !== norm(query.case_type)) return false;

    if (query.planning_status) {
      const wantNone = query.planning_status === CASES_INDEX_NONE_VALUE;
      const has = !!row.surgeryPlan;
      if (wantNone) {
        if (has) return false;
      } else if (!has || norm(row.surgeryPlan?.planning_status) !== norm(query.planning_status)) {
        return false;
      }
    }

    if (query.procedure_status) {
      const wantNone = query.procedure_status === CASES_INDEX_NONE_VALUE;
      const has = !!row.procedureDay;
      if (wantNone) {
        if (has) return false;
      } else if (!has || norm(row.procedureDay?.procedure_status) !== norm(query.procedure_status)) {
        return false;
      }
    }

    if (query.post_op_status) {
      const wantNone = query.post_op_status === CASES_INDEX_NONE_VALUE;
      const has = !!row.postOpTracking;
      if (wantNone) {
        if (has) return false;
      } else if (!has || norm(row.postOpTracking?.post_op_status) !== norm(query.post_op_status)) {
        return false;
      }
    }

    if (query.readiness !== "all" && row.readinessBucket !== query.readiness) return false;

    return true;
  });
}

function parseIsoMs(iso: string | null | undefined): number {
  if (!iso?.trim()) return Number.NaN;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NaN : t;
}

/**
 * Sorts the worklist per query (stable for equal keys).
 */
export function sortCaseWorklistRows(rows: CaseWorklistRow[], sort: CasesIndexQuery["sort"]): CaseWorklistRow[] {
  const copy = [...rows];
  const updatedDesc = (a: CaseWorklistRow, b: CaseWorklistRow) =>
    parseIsoMs(b.updated_at) - parseIsoMs(a.updated_at) || a.id.localeCompare(b.id);
  const createdDesc = (a: CaseWorklistRow, b: CaseWorklistRow) =>
    parseIsoMs(b.created_at) - parseIsoMs(a.created_at) || a.id.localeCompare(b.id);

  if (sort === "updated_desc") {
    copy.sort(updatedDesc);
    return copy;
  }
  if (sort === "created_desc") {
    copy.sort(createdDesc);
    return copy;
  }
  if (sort === "procedure_date_desc") {
    copy.sort((a, b) => {
      const ad = a.procedureDate ? Date.parse(`${a.procedureDate}T12:00:00Z`) : Number.NaN;
      const bd = b.procedureDate ? Date.parse(`${b.procedureDate}T12:00:00Z`) : Number.NaN;
      const aOk = !Number.isNaN(ad);
      const bOk = !Number.isNaN(bd);
      if (aOk && bOk && bd !== ad) return bd - ad;
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
      return updatedDesc(a, b);
    });
    return copy;
  }
  // readiness_attention_desc
  copy.sort((a, b) => {
    if (a.readinessNeedsAttention !== b.readinessNeedsAttention) {
      return a.readinessNeedsAttention ? -1 : 1;
    }
    if (a.readinessPercent !== b.readinessPercent) return a.readinessPercent - b.readinessPercent;
    return updatedDesc(a, b);
  });
  return copy;
}

/** Unique non-empty strings, sorted for stable selects. */
function uniqSorted(values: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const v of values) {
    const t = v?.trim();
    if (t) s.add(t);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

export function deriveCasesIndexFilterOptions(rows: CaseWorklistRow[]): CasesIndexFilterOptions {
  const planning = rows.map((r) => r.surgeryPlan?.planning_status ?? null);
  const proc = rows.map((r) => r.procedureDay?.procedure_status ?? null);
  const post = rows.map((r) => r.postOpTracking?.post_op_status ?? null);
  return {
    statuses: uniqSorted(rows.map((r) => r.status)),
    treatment_types: uniqSorted(rows.map((r) => r.treatment_type)),
    case_types: uniqSorted(rows.map((r) => r.case_type)),
    planning_statuses: uniqSorted(planning),
    procedure_statuses: uniqSorted(proc),
    post_op_statuses: uniqSorted(post),
  };
}

export type CasesWorklistPageResult<T> = {
  pageRows: T[];
  total: number;
  page: number;
  pageSize: CasesIndexPageSize;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
};

/**
 * Slices sorted+filtered rows for the current page (1-based). Clamps page to valid range.
 */
export function paginateCaseWorklistRows<T>(rows: T[], page: number, pageSize: CasesIndexPageSize): CasesWorklistPageResult<T> {
  const total = rows.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const rangeStart = total === 0 ? 0 : start + 1;
  const rangeEnd = total === 0 ? 0 : start + pageRows.length;
  return { pageRows, total, page: safePage, pageSize, totalPages, rangeStart, rangeEnd };
}
