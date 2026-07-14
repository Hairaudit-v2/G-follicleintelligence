/**
 * FI-UX-REBUILD-1 S4.5A / OPERATIONS-1 — Pipeline URL view + ops query bridge.
 *
 * Remove temporary legacy view map after legacy CRM views are retired.
 */

import {
  parsePipelineOpsQuery,
  type PipelineOpsQueryState,
} from "@/src/lib/crm/pipelineOperationsQuery";
import type { PipelineWorkspaceView } from "@/src/lib/crm/pipelineUiHelpers";

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Map legacy CRM `/crm?view=` values to Pipeline workspace views.
 *
 * | Query             | Initial view |
 * | ----------------- | ------------ |
 * | absent            | Board        |
 * | `view=board`      | Board        |
 * | `view=workspace`  | Board        |
 * | `view=list`       | Board        |
 * | `view=follow_ups` | Follow-ups   |
 * | `view=inactive_review` | Inactive review |
 * | unknown           | Board        |
 */
export function resolvePipelineInitialView(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams
): PipelineWorkspaceView {
  const raw =
    searchParams instanceof URLSearchParams
      ? searchParams.get("view")
      : firstString(searchParams.view);

  const view = (raw ?? "").trim().toLowerCase();
  if (view === "follow_ups") return "follow_ups";
  if (view === "inactive_review" || view === "inactive") return "inactive_review";
  return "board";
}

/**
 * Shared shell/full ops query normalization (same searchParams → same state).
 */
export function resolvePipelineOpsQuery(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams
): PipelineOpsQueryState {
  return parsePipelineOpsQuery(searchParams);
}

/**
 * Inject board window sort for newest-first default without inventing names in URL.
 * Maps ops sort → existing CRM list sort keys where supported.
 */
export function pipelineOpsToBoardSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> {
  const ops = parsePipelineOpsQuery(searchParams);
  const next: Record<string, string | string[] | undefined> = { ...searchParams };
  // Prefer created_at_desc for newest-first board window (default ops)
  const sortRaw = String(Array.isArray(next.sort) ? next.sort[0] : (next.sort ?? ""))
    .trim()
    .toLowerCase();
  if (
    !sortRaw ||
    sortRaw === "newest_first" ||
    sortRaw === "newest" ||
    sortRaw === "oldest_first" ||
    sortRaw === "oldest" ||
    sortRaw === "oldest_created" ||
    sortRaw === "newest_created"
  ) {
    next.sort = "created_at_desc";
  } else if (
    sortRaw === "recently_updated" ||
    sortRaw === "most_recently_lost" ||
    sortRaw === "oldest_untouched" ||
    sortRaw === "oldest_lost" ||
    sortRaw === "recent" ||
    sortRaw === "untouched"
  ) {
    next.sort = "updated_at_desc";
  }
  // Pass owner for server window when UUID present
  if (ops.ownerId) next.owner = ops.ownerId;
  return next;
}
