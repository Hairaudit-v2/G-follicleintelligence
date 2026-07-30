/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.5 — UI constants (pure).
 * Aligns with 1A.4 API contracts; no engine logic.
 */

export const PILOT_CONTROL_UI_ROUTE = "/admin/pilot-control" as const;
export const PILOT_CONTROL_FI_ADMIN_SEGMENT = "pilot-control" as const;
export const PILOT_CONTROL_NAV_ID = "pilot-control" as const;

export const PILOT_CONTROL_REFRESH_MS = {
  overview: 90_000,
  blockers: 90_000,
  patients: 120_000,
  activity: 120_000,
  health: 90_000,
} as const;

export const PILOT_CONTROL_SEARCH_DEBOUNCE_MS = 350;

export const PILOT_CONTROL_MAX_PAGE_SIZE = 100;
export const PILOT_CONTROL_DEFAULT_PAGE_SIZE = 25;
export const PILOT_CONTROL_MAX_ACTIVITY_RANGE_DAYS = 31;
export const PILOT_CONTROL_MAX_EXPORT_ROWS = 500;
export const PILOT_CONTROL_MAX_SEARCH_LENGTH = 80;

export const PILOT_CONTROL_API_BASE = "/api/pilot-control";

export const PILOT_CONTROL_ALLOWLISTED_PATIENT_FILTERS = [
  "programmeId",
  "page",
  "pageSize",
  "status",
  "readiness",
  "blockerCategory",
  "severity",
  "ownerType",
  "clinicId",
  "milestone",
  "appActivation",
  "inactiveFor",
  "sort",
  "direction",
  "search",
  "tenantId",
] as const;

export const PILOT_CONTROL_ALLOWLISTED_BLOCKER_FILTERS = [
  "programmeId",
  "patientId",
  "state",
  "category",
  "dimension",
  "severity",
  "ownerType",
  "ownerUserId",
  "escalated",
  "requiresPilotPause",
  "ageFrom",
  "ageTo",
  "page",
  "pageSize",
  "sort",
  "direction",
  "tenantId",
] as const;

export const READINESS_DISTRIBUTION_DISCLAIMER =
  "Readiness distribution is currently derived from blocker and enrolment data. Full batch readiness aggregation will be added before pilot expansion.";

export const EXPORT_ROLE_NOTICE =
  "Exports contain only the fields permitted for your current role.";

export const EMPTY_COHORT_MESSAGE =
  "No real patients are currently enrolled.\n\nThe Controlled Pilot foundation, readiness engine, blocker engine and APIs are available, but live pilot evidence has not yet begun.\n\nReal patient invitations remain disabled.";

export const PARTIAL_RESPONSE_MESSAGE =
  "Some source information could not be evaluated.\nReadiness has been downgraded where mandatory data was unavailable.";

export const PERMISSION_LIMITED_MESSAGE =
  "Some clinical or financial details are hidden for your role.";

export const ACTIVE_BLOCKER_STATES = ["open", "acknowledged", "in_progress"] as const;
export const HISTORY_BLOCKER_STATES = ["resolved", "superseded", "dismissed"] as const;
