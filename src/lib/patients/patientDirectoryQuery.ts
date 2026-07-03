import {
  isNorwoodScaleValue,
  NORWOOD_SCALE_VALUES,
  type NorwoodScaleValue,
} from "./hairLossScales";
import { isAllowedPatientStatus, type PatientStatusValue } from "./patientPolicy";
import {
  applySavedViewToLegacyQueryFields,
  patientDirectoryHasLegacyFilters,
  type PatientOsSavedViewId,
} from "./patientDirectoryFilters";

export type PatientDirectorySort = "created_desc" | "created_asc";

export type PatientDirectoryQuery = {
  search: string;
  patientStatus: PatientStatusValue | null;
  hasActiveCase: boolean | null;
  hasFutureBooking: boolean | null;
  norwoodMin: NorwoodScaleValue | null;
  norwoodMax: NorwoodScaleValue | null;
  /** Inclusive day bounds on latest booking `start_at` (UTC). */
  lastVisitFrom: string | null;
  lastVisitTo: string | null;
  /** Matches `fi_crm_lead_source_ids.source_system` or lead `metadata.source_system`. */
  leadSource: string | null;
  /** Legacy / returning Timely visibility filters (FI-LEGACY-PATIENTOS-FILTER-1). */
  returningFromTimely: boolean | null;
  hasLegacySource: boolean | null;
  historicalIncomplete: boolean | null;
  hasFollowUpEncounter: boolean | null;
  hasPhotosCaptured: boolean | null;
  aiReviewPending: boolean | null;
  clinicianApprovedAi: boolean | null;
  needsMergeReview: boolean | null;
  photosNoAiApproval: boolean | null;
  /** Follow-up encounter created_at lower bound (ISO). */
  followUpSince: string | null;
  savedView: PatientOsSavedViewId | null;
  sort: PatientDirectorySort;
  page: number;
  pageSize: number;
};

type OrderedNorwood = Exclude<NorwoodScaleValue, "unknown">;

const NORWOOD_ORDER: OrderedNorwood[] = NORWOOD_SCALE_VALUES.filter(
  (v): v is OrderedNorwood => v !== "unknown"
);

function orderedNorwood(v: NorwoodScaleValue | null): OrderedNorwood | null {
  if (!v || v === "unknown") return null;
  return v;
}

/** Norwood stages between min and max (inclusive), excluding `unknown`. */
export function norwoodValuesInRange(
  min: NorwoodScaleValue | null,
  max: NorwoodScaleValue | null
): NorwoodScaleValue[] | null {
  if (!min && !max) return null;
  const lo = orderedNorwood(min) ? NORWOOD_ORDER.indexOf(orderedNorwood(min)!) : 0;
  const hi = orderedNorwood(max)
    ? NORWOOD_ORDER.indexOf(orderedNorwood(max)!)
    : NORWOOD_ORDER.length - 1;
  if (lo < 0 || hi < 0 || lo > hi) return [];
  return NORWOOD_ORDER.slice(lo, hi + 1);
}

export function patientDirectoryHasActiveFilters(q: PatientDirectoryQuery): boolean {
  return Boolean(
    q.search.trim() ||
    q.patientStatus ||
    q.hasActiveCase != null ||
    q.hasFutureBooking != null ||
    q.norwoodMin ||
    q.norwoodMax ||
    q.lastVisitFrom ||
    q.lastVisitTo ||
    q.leadSource ||
    patientDirectoryHasLegacyFilters(q)
  );
}

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

  const norwoodMinRaw = firstString(sp.norwoodMin)?.trim();
  const norwoodMaxRaw = firstString(sp.norwoodMax)?.trim();
  const norwoodMin = norwoodMinRaw && isNorwoodScaleValue(norwoodMinRaw) ? norwoodMinRaw : null;
  const norwoodMax = norwoodMaxRaw && isNorwoodScaleValue(norwoodMaxRaw) ? norwoodMaxRaw : null;

  const lastVisitFromRaw = (firstString(sp.lastVisitFrom) ?? "").trim();
  const lastVisitToRaw = (firstString(sp.lastVisitTo) ?? "").trim();
  const lastVisitFrom = /^\d{4}-\d{2}-\d{2}$/.test(lastVisitFromRaw)
    ? `${lastVisitFromRaw}T00:00:00.000Z`
    : null;
  const lastVisitTo = /^\d{4}-\d{2}-\d{2}$/.test(lastVisitToRaw)
    ? `${lastVisitToRaw}T23:59:59.999Z`
    : null;

  const leadSourceRaw = (firstString(sp.leadSource) ?? "").trim();
  const leadSource = leadSourceRaw ? leadSourceRaw.slice(0, 128) : null;

  const savedViewRaw = (firstString(sp.savedView) ?? "").trim();
  const savedViewIds = [
    "returning_timely",
    "legacy_followups_this_week",
    "imaging_ai_review_pending",
    "historical_incomplete",
    "needs_merge_review",
    "photos_no_ai_approval",
  ] as const;
  const savedView = savedViewIds.includes(savedViewRaw as (typeof savedViewIds)[number])
    ? (savedViewRaw as PatientOsSavedViewId)
    : null;

  let query: PatientDirectoryQuery = {
    search: (firstString(sp.q) ?? "").trim(),
    patientStatus,
    hasActiveCase: parseBool(firstString(sp.hasActiveCase)),
    hasFutureBooking: parseBool(firstString(sp.hasFutureBooking)),
    norwoodMin,
    norwoodMax,
    lastVisitFrom,
    lastVisitTo,
    leadSource,
    returningFromTimely: parseBool(firstString(sp.returningFromTimely)),
    hasLegacySource: parseBool(firstString(sp.hasLegacySource)),
    historicalIncomplete: parseBool(firstString(sp.historicalIncomplete)),
    hasFollowUpEncounter: parseBool(firstString(sp.hasFollowUpEncounter)),
    hasPhotosCaptured: parseBool(firstString(sp.hasPhotosCaptured)),
    aiReviewPending: parseBool(firstString(sp.aiReviewPending)),
    clinicianApprovedAi: parseBool(firstString(sp.clinicianApprovedAi)),
    needsMergeReview: parseBool(firstString(sp.needsMergeReview)),
    photosNoAiApproval: parseBool(firstString(sp.photosNoAiApproval)),
    followUpSince: (firstString(sp.followUpSince) ?? "").trim() || null,
    savedView,
    sort,
    page: parsePage(firstString(sp.page)),
    pageSize: parsePageSize(firstString(sp.pageSize)),
  };

  if (savedView) {
    query = { ...applySavedViewToLegacyQueryFields(query, savedView), page: 1 };
  }

  return query;
}

export function patientDirectoryQueryToHrefQuery(q: PatientDirectoryQuery): Record<string, string> {
  const out: Record<string, string> = {};
  if (q.search) out.q = q.search;
  if (q.patientStatus) out.status = q.patientStatus;
  if (q.hasActiveCase === true) out.hasActiveCase = "true";
  if (q.hasActiveCase === false) out.hasActiveCase = "false";
  if (q.hasFutureBooking === true) out.hasFutureBooking = "true";
  if (q.hasFutureBooking === false) out.hasFutureBooking = "false";
  if (q.norwoodMin) out.norwoodMin = q.norwoodMin;
  if (q.norwoodMax) out.norwoodMax = q.norwoodMax;
  if (q.lastVisitFrom) out.lastVisitFrom = q.lastVisitFrom.slice(0, 10);
  if (q.lastVisitTo) out.lastVisitTo = q.lastVisitTo.slice(0, 10);
  if (q.leadSource) out.leadSource = q.leadSource;
  if (q.returningFromTimely === true) out.returningFromTimely = "true";
  if (q.hasLegacySource === true) out.hasLegacySource = "true";
  if (q.historicalIncomplete === true) out.historicalIncomplete = "true";
  if (q.hasFollowUpEncounter === true) out.hasFollowUpEncounter = "true";
  if (q.hasPhotosCaptured === true) out.hasPhotosCaptured = "true";
  if (q.aiReviewPending === true) out.aiReviewPending = "true";
  if (q.clinicianApprovedAi === true) out.clinicianApprovedAi = "true";
  if (q.needsMergeReview === true) out.needsMergeReview = "true";
  if (q.photosNoAiApproval === true) out.photosNoAiApproval = "true";
  if (q.followUpSince) out.followUpSince = q.followUpSince;
  if (q.savedView) out.savedView = q.savedView;
  if (q.sort !== "created_desc") out.sort = q.sort;
  if (q.page > 1) out.page = String(q.page);
  if (q.pageSize !== DEFAULT_PAGE_SIZE) out.pageSize = String(q.pageSize);
  return out;
}

export function buildPatientDirectoryHref(
  tenantId: string,
  q: PatientDirectoryQuery,
  opts?: { view?: "list" }
): string {
  const tid = tenantId.trim();
  const params = new URLSearchParams(patientDirectoryQueryToHrefQuery(q));
  if (opts?.view === "list") params.set("view", "list");
  const qs = params.toString();
  return qs ? `/fi-admin/${tid}/patients?${qs}` : `/fi-admin/${tid}/patients`;
}
