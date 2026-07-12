/**
 * FI-UX-REBUILD-1 S4.5A — temporary legacy `?view=` → Pipeline initial view map.
 *
 * Remove after legacy CRM views are retired.
 */

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
  return "board";
}
