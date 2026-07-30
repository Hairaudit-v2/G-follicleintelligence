/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.5 — URL filter helpers (pure).
 * Only allowlisted query keys; no raw query syntax.
 */

import {
  PILOT_CONTROL_ALLOWLISTED_BLOCKER_FILTERS,
  PILOT_CONTROL_ALLOWLISTED_PATIENT_FILTERS,
  PILOT_CONTROL_DEFAULT_PAGE_SIZE,
  PILOT_CONTROL_MAX_PAGE_SIZE,
  PILOT_CONTROL_MAX_SEARCH_LENGTH,
} from "./pilotControlUiConstants";

export type PilotPatientFilterState = {
  programmeId: string;
  page: number;
  pageSize: number;
  status?: string;
  readiness?: string;
  blockerCategory?: string;
  severity?: string;
  ownerType?: string;
  clinicId?: string;
  milestone?: string;
  appActivation?: string;
  inactiveFor?: string;
  sort?: string;
  direction?: "asc" | "desc";
  search?: string;
};

export type PilotBlockerFilterState = {
  programmeId: string;
  page: number;
  pageSize: number;
  patientId?: string;
  state?: string;
  category?: string;
  dimension?: string;
  severity?: string;
  ownerType?: string;
  ownerUserId?: string;
  escalated?: string;
  requiresPilotPause?: string;
  ageFrom?: string;
  ageTo?: string;
  sort?: string;
  direction?: "asc" | "desc";
};

const PATIENT_KEYS = new Set<string>(PILOT_CONTROL_ALLOWLISTED_PATIENT_FILTERS);
const BLOCKER_KEYS = new Set<string>(PILOT_CONTROL_ALLOWLISTED_BLOCKER_FILTERS);

function one(sp: URLSearchParams | Record<string, string | string[] | undefined>, key: string): string | undefined {
  if (sp instanceof URLSearchParams) {
    const v = sp.get(key);
    return v?.trim() || undefined;
  }
  const raw = sp[key];
  if (typeof raw === "string") return raw.trim() || undefined;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim() || undefined;
  return undefined;
}

function parsePositiveInt(raw: string | undefined, fallback: number, max?: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  const i = Math.floor(n);
  if (max != null && i > max) return max;
  return i;
}

export function parsePatientFiltersFromSearchParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
  defaultProgrammeId: string
): PilotPatientFilterState {
  const pageSize = parsePositiveInt(
    one(sp, "pageSize"),
    PILOT_CONTROL_DEFAULT_PAGE_SIZE,
    PILOT_CONTROL_MAX_PAGE_SIZE
  );
  const searchRaw = one(sp, "search");
  const search =
    searchRaw && searchRaw.length > PILOT_CONTROL_MAX_SEARCH_LENGTH
      ? searchRaw.slice(0, PILOT_CONTROL_MAX_SEARCH_LENGTH)
      : searchRaw;
  const direction = one(sp, "direction");
  return {
    programmeId: one(sp, "programmeId") || defaultProgrammeId,
    page: parsePositiveInt(one(sp, "page"), 1),
    pageSize,
    status: one(sp, "status"),
    readiness: one(sp, "readiness"),
    blockerCategory: one(sp, "blockerCategory"),
    severity: one(sp, "severity"),
    ownerType: one(sp, "ownerType"),
    clinicId: one(sp, "clinicId"),
    milestone: one(sp, "milestone"),
    appActivation: one(sp, "appActivation"),
    inactiveFor: one(sp, "inactiveFor"),
    sort: one(sp, "sort"),
    direction: direction === "asc" || direction === "desc" ? direction : undefined,
    search,
  };
}

export function parseBlockerFiltersFromSearchParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
  defaultProgrammeId: string
): PilotBlockerFilterState {
  return {
    programmeId: one(sp, "programmeId") || defaultProgrammeId,
    page: parsePositiveInt(one(sp, "page"), 1),
    pageSize: parsePositiveInt(
      one(sp, "pageSize"),
      PILOT_CONTROL_DEFAULT_PAGE_SIZE,
      PILOT_CONTROL_MAX_PAGE_SIZE
    ),
    patientId: one(sp, "patientId"),
    state: one(sp, "state"),
    category: one(sp, "category"),
    dimension: one(sp, "dimension"),
    severity: one(sp, "severity"),
    ownerType: one(sp, "ownerType"),
    ownerUserId: one(sp, "ownerUserId"),
    escalated: one(sp, "escalated"),
    requiresPilotPause: one(sp, "requiresPilotPause"),
    ageFrom: one(sp, "ageFrom"),
    ageTo: one(sp, "ageTo"),
    sort: one(sp, "sort"),
    direction: (() => {
      const d = one(sp, "direction");
      return d === "asc" || d === "desc" ? d : undefined;
    })(),
  };
}

/** Strip unknown keys; return only allowlisted patient filter entries for API calls. */
export function patientFiltersToQuery(filters: PilotPatientFilterState): Record<string, string> {
  const out: Record<string, string> = {
    programmeId: filters.programmeId,
    page: String(filters.page),
    pageSize: String(Math.min(filters.pageSize, PILOT_CONTROL_MAX_PAGE_SIZE)),
  };
  const optional: Array<[keyof PilotPatientFilterState, string | undefined]> = [
    ["status", filters.status],
    ["readiness", filters.readiness],
    ["blockerCategory", filters.blockerCategory],
    ["severity", filters.severity],
    ["ownerType", filters.ownerType],
    ["clinicId", filters.clinicId],
    ["milestone", filters.milestone],
    ["appActivation", filters.appActivation],
    ["inactiveFor", filters.inactiveFor],
    ["sort", filters.sort],
    ["direction", filters.direction],
    ["search", filters.search],
  ];
  for (const [key, val] of optional) {
    if (val && PATIENT_KEYS.has(key)) out[key] = val;
  }
  return out;
}

export function blockerFiltersToQuery(filters: PilotBlockerFilterState): Record<string, string> {
  const out: Record<string, string> = {
    programmeId: filters.programmeId,
    page: String(filters.page),
    pageSize: String(Math.min(filters.pageSize, PILOT_CONTROL_MAX_PAGE_SIZE)),
  };
  const optional: Array<[string, string | undefined]> = [
    ["patientId", filters.patientId],
    ["state", filters.state],
    ["category", filters.category],
    ["dimension", filters.dimension],
    ["severity", filters.severity],
    ["ownerType", filters.ownerType],
    ["ownerUserId", filters.ownerUserId],
    ["escalated", filters.escalated],
    ["requiresPilotPause", filters.requiresPilotPause],
    ["ageFrom", filters.ageFrom],
    ["ageTo", filters.ageTo],
    ["sort", filters.sort],
    ["direction", filters.direction],
  ];
  for (const [key, val] of optional) {
    if (val && BLOCKER_KEYS.has(key)) out[key] = val;
  }
  return out;
}

/** Reject arbitrary field names — only allowlisted keys survive. */
export function scrubUnknownFilterKeys(
  input: Record<string, string>,
  kind: "patients" | "blockers"
): Record<string, string> {
  const allow = kind === "patients" ? PATIENT_KEYS : BLOCKER_KEYS;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (allow.has(k) && v != null && String(v).trim()) out[k] = String(v).trim();
  }
  return out;
}

export function patientFiltersToUrlSearchParams(
  filters: PilotPatientFilterState,
  extra?: Record<string, string>
): URLSearchParams {
  const q = patientFiltersToQuery(filters);
  const sp = new URLSearchParams({ ...q, ...extra });
  return sp;
}

export function resetPatientFilters(programmeId: string): PilotPatientFilterState {
  return {
    programmeId,
    page: 1,
    pageSize: PILOT_CONTROL_DEFAULT_PAGE_SIZE,
  };
}

export function isAllowlistedPatientFilterKey(key: string): boolean {
  return PATIENT_KEYS.has(key);
}

export function isAllowlistedBlockerFilterKey(key: string): boolean {
  return BLOCKER_KEYS.has(key);
}
