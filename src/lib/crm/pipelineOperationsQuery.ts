/**
 * FI-PIPELINE-OPERATIONS-1 — URL-compatible Pipeline query normalization (pure).
 *
 * Shell and full loaders must share the same normalized state.
 * Unknown values fail safely to defaults. No patient/lead names in URLs.
 */

import { isNonEmptyUuid } from "@/src/lib/crm/validation";
import type { PipelineStaffColumnId } from "@/src/lib/crm/pipelineStaffModel";
import { PIPELINE_STAFF_COLUMN_ORDER } from "@/src/lib/crm/pipelineStaffModel";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const PIPELINE_OPS_SORT_MODES = [
  "newest_first",
  "oldest_first",
  "recently_updated",
  "oldest_untouched",
  "most_recently_lost",
  "oldest_lost",
  "newest_created",
  "oldest_created",
  "operational",
] as const;

export type PipelineOpsSortMode = (typeof PIPELINE_OPS_SORT_MODES)[number];

export const PIPELINE_OPS_VIEWS = ["board", "follow_ups", "inactive_review"] as const;
export type PipelineOpsView = (typeof PIPELINE_OPS_VIEWS)[number];

/** Lifecycle / staff-column filters (user-facing labels map to staff column ids). */
export const PIPELINE_OPS_LIFECYCLE_FILTERS = [
  "all",
  "new",
  "contacting",
  "qualified",
  "consultation",
  "planning_quote",
  "booked_deposit",
  "nurture",
  "closed_lost",
  "converted",
] as const;

export type PipelineOpsLifecycleFilter = (typeof PIPELINE_OPS_LIFECYCLE_FILTERS)[number];

export const PIPELINE_OPS_AGE_BUCKETS = [
  "today",
  "last_7_days",
  "8_30_days",
  "31_60_days",
  "61_90_days",
  "over_90_days",
] as const;

export type PipelineOpsAgeBucket = (typeof PIPELINE_OPS_AGE_BUCKETS)[number];

export const PIPELINE_OPS_ACTIVITY_FILTERS = [
  "has_overdue_follow_up",
  "has_upcoming_follow_up",
  "no_follow_up",
  "no_recent_contact",
  "has_consultation",
  "no_consultation",
  "unassigned",
] as const;

export type PipelineOpsActivityFilter = (typeof PIPELINE_OPS_ACTIVITY_FILTERS)[number];

/** Default inactivity threshold (days) for Inactive review. */
export const PIPELINE_OPS_DEFAULT_INACTIVE_AGE_DAYS = 30;

export type PipelineOpsQueryState = {
  view: PipelineOpsView;
  sort: PipelineOpsSortMode;
  /** Staff-column lifecycle filter; null = all. */
  lifecycle: PipelineStaffColumnId | null;
  /** Backend stage slug filter (optional). */
  stageSlug: string | null;
  age: PipelineOpsAgeBucket | null;
  ownerId: string | null;
  sourceKey: string | null;
  activity: PipelineOpsActivityFilter | null;
  /** Inactive review age threshold in days. */
  inactiveAgeDays: number;
  /**
   * When true, presentation applies user sort to all columns.
   * When false (sort operational), New uses newest default; others use urgency.
   */
  userSortSelected: boolean;
};

export const PIPELINE_OPS_DEFAULT_QUERY: PipelineOpsQueryState = {
  view: "board",
  sort: "newest_first",
  lifecycle: null,
  stageSlug: null,
  age: null,
  ownerId: null,
  sourceKey: null,
  activity: null,
  inactiveAgeDays: PIPELINE_OPS_DEFAULT_INACTIVE_AGE_DAYS,
  userSortSelected: false,
};

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function getParam(
  sp: Record<string, string | string[] | undefined> | URLSearchParams,
  key: string
): string | undefined {
  if (sp instanceof URLSearchParams) {
    const x = sp.get(key);
    return x ?? undefined;
  }
  return firstString(sp[key]);
}

const STAFF_COLUMN_SET = new Set<string>(PIPELINE_STAFF_COLUMN_ORDER);

/**
 * Normalize Pipeline operations query from URL search params.
 * Safe defaults for unknown/malformed values.
 */
export function parsePipelineOpsQuery(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams
): PipelineOpsQueryState {
  const viewRaw = (getParam(searchParams, "view") ?? "").trim().toLowerCase();
  let view: PipelineOpsView = "board";
  if (viewRaw === "follow_ups") view = "follow_ups";
  else if (viewRaw === "inactive_review" || viewRaw === "inactive") view = "inactive_review";
  // legacy board / workspace / list → board
  else if (viewRaw === "board" || viewRaw === "workspace" || viewRaw === "list" || !viewRaw) {
    view = "board";
  }

  const sortRaw = (getParam(searchParams, "sort") ?? "").trim().toLowerCase();
  let sort: PipelineOpsSortMode = "newest_first";
  let userSortSelected = false;
  if ((PIPELINE_OPS_SORT_MODES as readonly string[]).includes(sortRaw)) {
    sort = sortRaw as PipelineOpsSortMode;
    userSortSelected = sortRaw !== "" && sortRaw !== "operational";
  } else if (sortRaw === "created_at_desc" || sortRaw === "newest") {
    sort = "newest_first";
    userSortSelected = true;
  } else if (sortRaw === "created_at_asc" || sortRaw === "oldest") {
    sort = "oldest_first";
    userSortSelected = true;
  } else if (sortRaw === "updated_at_desc" || sortRaw === "recent") {
    sort = "recently_updated";
    userSortSelected = true;
  } else if (sortRaw === "updated_at_asc" || sortRaw === "untouched") {
    sort = "oldest_untouched";
    userSortSelected = true;
  } else if (!sortRaw) {
    // Default: presentation New column newest-first; no user override flag
    sort = "newest_first";
    userSortSelected = false;
  }

  // Lost view defaults sort when lifecycle is lost and no explicit sort
  const lifecycleRaw = (getParam(searchParams, "lifecycle") ?? getParam(searchParams, "stage") ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  let lifecycle: PipelineStaffColumnId | null = null;
  if (lifecycleRaw && lifecycleRaw !== "all") {
    // aliases
    const alias: Record<string, PipelineStaffColumnId> = {
      planning: "planning_quote",
      planning_quote: "planning_quote",
      quote: "planning_quote",
      booked: "booked_deposit",
      booked_deposit: "booked_deposit",
      deposit: "booked_deposit",
      lost: "closed_lost",
      closed_lost: "closed_lost",
      closed: "closed_lost",
      won: "converted",
      converted: "converted",
    };
    if (alias[lifecycleRaw]) lifecycle = alias[lifecycleRaw]!;
    else if (STAFF_COLUMN_SET.has(lifecycleRaw)) {
      lifecycle = lifecycleRaw as PipelineStaffColumnId;
    }
  }

  // When view is inactive_review, force lifecycle null (predicate owns visibility)
  if (view === "inactive_review") {
    lifecycle = null;
  }

  // Lost default sort
  if (lifecycle === "closed_lost" && !userSortSelected && !sortRaw) {
    sort = "most_recently_lost";
  }

  const ageRaw = (getParam(searchParams, "age") ?? "").trim().toLowerCase().replace(/-/g, "_");
  let age: PipelineOpsAgeBucket | null = null;
  const ageAlias: Record<string, PipelineOpsAgeBucket> = {
    today: "today",
    last_7_days: "last_7_days",
    "7d": "last_7_days",
    "7_days": "last_7_days",
    "8_30_days": "8_30_days",
    "8_30": "8_30_days",
    "31_60_days": "31_60_days",
    "31_60": "31_60_days",
    "61_90_days": "61_90_days",
    "61_90": "61_90_days",
    over_90_days: "over_90_days",
    over_90: "over_90_days",
    "90_plus": "over_90_days",
  };
  if (ageRaw && ageAlias[ageRaw]) age = ageAlias[ageRaw]!;
  else if ((PIPELINE_OPS_AGE_BUCKETS as readonly string[]).includes(ageRaw)) {
    age = ageRaw as PipelineOpsAgeBucket;
  }

  const ownerRaw = (getParam(searchParams, "owner") ?? "").trim();
  const ownerId = isNonEmptyUuid(ownerRaw) ? ownerRaw : null;

  const sourceKey =
    (getParam(searchParams, "source") ?? "").trim().slice(0, 80) || null;

  const activityRaw = (getParam(searchParams, "activity") ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  let activity: PipelineOpsActivityFilter | null = null;
  if ((PIPELINE_OPS_ACTIVITY_FILTERS as readonly string[]).includes(activityRaw)) {
    activity = activityRaw as PipelineOpsActivityFilter;
  } else {
    const actAlias: Record<string, PipelineOpsActivityFilter> = {
      overdue: "has_overdue_follow_up",
      upcoming: "has_upcoming_follow_up",
      no_follow_up: "no_follow_up",
      no_recent: "no_recent_contact",
      has_consultation: "has_consultation",
      no_consultation: "no_consultation",
      unassigned: "unassigned",
    };
    if (actAlias[activityRaw]) activity = actAlias[activityRaw]!;
  }

  const inactiveRaw = (getParam(searchParams, "inactiveAgeDays") ?? "").trim();
  let inactiveAgeDays = PIPELINE_OPS_DEFAULT_INACTIVE_AGE_DAYS;
  if (inactiveRaw) {
    const n = Number.parseInt(inactiveRaw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 3650) inactiveAgeDays = n;
  }

  // Optional backend stage slug (not UUID — avoid clobbering owner UUIDs)
  const stageSlugRaw = (getParam(searchParams, "backendStage") ?? "").trim().toLowerCase();
  const stageSlug =
    stageSlugRaw && !isNonEmptyUuid(stageSlugRaw) && stageSlugRaw.length <= 80
      ? stageSlugRaw
      : null;

  return {
    view,
    sort,
    lifecycle,
    stageSlug,
    age,
    ownerId,
    sourceKey,
    activity,
    inactiveAgeDays,
    userSortSelected,
  };
}

/**
 * Serialize ops query to URL search params (omits defaults).
 * Never includes lead or patient names.
 */
export function pipelineOpsQueryToSearchParams(
  state: PipelineOpsQueryState
): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.view !== "board") sp.set("view", state.view);
  if (state.userSortSelected || state.sort !== "newest_first") {
    sp.set("sort", state.sort);
  }
  if (state.lifecycle) sp.set("lifecycle", state.lifecycle);
  if (state.stageSlug) sp.set("backendStage", state.stageSlug);
  if (state.age) sp.set("age", state.age);
  if (state.ownerId) sp.set("owner", state.ownerId);
  if (state.sourceKey) sp.set("source", state.sourceKey);
  if (state.activity) sp.set("activity", state.activity);
  if (state.inactiveAgeDays !== PIPELINE_OPS_DEFAULT_INACTIVE_AGE_DAYS) {
    sp.set("inactiveAgeDays", String(state.inactiveAgeDays));
  }
  return sp;
}

/**
 * Map ops sort to board RPC sort when possible (server window only).
 * Presentation re-sort always runs for determinism within the window.
 */
export function pipelineOpsSortToBoardListSort(
  sort: PipelineOpsSortMode
): "created_at_desc" | "updated_at_desc" | "created_at_asc" | "updated_at_asc" | null {
  switch (sort) {
    case "newest_first":
    case "newest_created":
      return "created_at_desc";
    case "oldest_first":
    case "oldest_created":
      return "created_at_asc";
    case "recently_updated":
    case "most_recently_lost":
      return "updated_at_desc";
    case "oldest_untouched":
    case "oldest_lost":
      return "updated_at_asc";
    default:
      return "created_at_desc";
  }
}

/** Sort mode labels for UI. */
export function pipelineOpsSortLabel(mode: PipelineOpsSortMode): string {
  switch (mode) {
    case "newest_first":
      return "Newest first";
    case "oldest_first":
      return "Oldest first";
    case "recently_updated":
      return "Recently updated";
    case "oldest_untouched":
      return "Oldest untouched";
    case "most_recently_lost":
      return "Most recently lost";
    case "oldest_lost":
      return "Oldest lost";
    case "newest_created":
      return "Newest created";
    case "oldest_created":
      return "Oldest created";
    case "operational":
      return "Operational urgency";
    default:
      return "Newest first";
  }
}

export function pipelineOpsAgeLabel(bucket: PipelineOpsAgeBucket): string {
  switch (bucket) {
    case "today":
      return "Today";
    case "last_7_days":
      return "Last 7 days";
    case "8_30_days":
      return "8–30 days";
    case "31_60_days":
      return "31–60 days";
    case "61_90_days":
      return "61–90 days";
    case "over_90_days":
      return "Over 90 days";
    default:
      return bucket;
  }
}

export function pipelineOpsActivityLabel(a: PipelineOpsActivityFilter): string {
  switch (a) {
    case "has_overdue_follow_up":
      return "Has overdue follow-up";
    case "has_upcoming_follow_up":
      return "Has upcoming follow-up";
    case "no_follow_up":
      return "No follow-up";
    case "no_recent_contact":
      return "No recent contact";
    case "has_consultation":
      return "Has consultation";
    case "no_consultation":
      return "No consultation";
    case "unassigned":
      return "Unassigned";
    default:
      return a;
  }
}
