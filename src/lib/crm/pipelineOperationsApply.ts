/**
 * FI-PIPELINE-OPERATIONS-1 — apply sort + filter to a presentation (pure).
 *
 * Does not change lead identity set origin — only visibility within loaded columns.
 * Shell and full must receive the same query; enrichment-only filters may hide
 * more on full than shell (documented via diagnostics note).
 */

import type {
  PipelineLeadCard,
  PipelinePresentation,
  PipelinePresentationColumn,
} from "@/src/lib/crm/pipelinePresentation.types";
import type {
  PipelineOpsQueryState,
  PipelineOpsSortMode,
} from "@/src/lib/crm/pipelineOperationsQuery";
import { cardMatchesOpsQuery } from "@/src/lib/crm/pipelineOperationsFilters";
import {
  compareNewColumnDefault,
  comparePipelineOpsSort,
  pipelineCardToOpsSortable,
  sortPipelineCardsByOpsMode,
} from "@/src/lib/crm/pipelineOperationsSort";
import type { PipelineStaffColumnId } from "@/src/lib/crm/pipelineStaffModel";

export type ApplyPipelineOpsResult = {
  presentation: PipelinePresentation;
  /** Lead ids visible after presentation filter (stable sorted). */
  visibleLeadIds: string[];
  /** True when full-tier-only fields may have changed membership vs shell. */
  enrichmentFilterApplied: boolean;
};

function sortColumnCards(
  columnId: PipelineStaffColumnId,
  cards: readonly PipelineLeadCard[],
  query: PipelineOpsQueryState
): PipelineLeadCard[] {
  const list = [...cards];

  // User selected a sort mode → apply globally
  if (query.userSortSelected || query.view === "inactive_review") {
    const mode: PipelineOpsSortMode =
      query.view === "inactive_review" && !query.userSortSelected ? "oldest_untouched" : query.sort;
    return sortPipelineCardsByOpsMode(list, mode);
  }

  // Lost column defaults
  if (columnId === "closed_lost") {
    return sortPipelineCardsByOpsMode(list, "most_recently_lost");
  }

  // New column default: newest first with updated tie-break
  if (columnId === "new") {
    return list.sort((a, b) =>
      compareNewColumnDefault(pipelineCardToOpsSortable(a), pipelineCardToOpsSortable(b))
    );
  }

  // Converted: newest conversion first (presentation already did this; keep newest_created-ish)
  if (columnId === "converted") {
    return sortPipelineCardsByOpsMode(list, "most_recently_lost"); // uses converted/lost timestamps
  }

  // Other active / holding: operational urgency (already applied in builder; re-apply for safety)
  return list.sort((a, b) =>
    comparePipelineOpsSort(
      "operational",
      pipelineCardToOpsSortable(a),
      pipelineCardToOpsSortable(b)
    )
  );
}

/**
 * Filter + re-sort presentation columns per ops query.
 * One card per leadId preserved; no merge.
 */
export function applyPipelineOpsToPresentation(
  presentation: PipelinePresentation,
  query: PipelineOpsQueryState,
  nowMs: number
): ApplyPipelineOpsResult {
  const enrichmentFilterApplied =
    query.activity != null || query.view === "inactive_review" || query.age != null;

  const columns: PipelinePresentationColumn[] = presentation.columns.map((col) => {
    let cards = col.cards.filter((card) => cardMatchesOpsQuery(card, query, nowMs));

    // Inactive review: flatten conceptually but keep column structure for board chrome
    // When lifecycle filter set and not matching this column, empty
    if (query.lifecycle && col.id !== query.lifecycle && query.view !== "inactive_review") {
      cards = [];
    }

    cards = sortColumnCards(col.id, cards, query);

    // Dedupe within column by leadId (should already be unique)
    const seen = new Set<string>();
    const unique: PipelineLeadCard[] = [];
    for (const c of cards) {
      if (seen.has(c.leadId)) continue;
      seen.add(c.leadId);
      unique.push(c);
    }

    return {
      ...col,
      cards: unique,
      count: unique.length,
    };
  });

  const visibleLeadIds = [
    ...new Set(columns.flatMap((c) => c.cards.map((card) => card.leadId))),
  ].sort((a, b) => a.localeCompare(b));

  // Summary: recompute light counts from filtered columns (do not invent source totals)
  const byColumn = { ...presentation.summary.byColumn };
  for (const col of columns) {
    byColumn[col.id] = col.count;
  }

  const active = columns.filter((c) => c.kind === "active").reduce((n, c) => n + c.count, 0);
  const holding = columns.filter((c) => c.kind === "holding").reduce((n, c) => n + c.count, 0);
  const converted = columns.find((c) => c.id === "converted")?.count ?? 0;
  const lost = columns.find((c) => c.id === "closed_lost")?.count ?? 0;

  const next: PipelinePresentation = {
    ...presentation,
    columns,
    summary: {
      ...presentation.summary,
      // Keep source-level totals from diagnostics; visible board counts update
      active,
      holding,
      converted,
      lost,
      byColumn,
      unassigned: columns.reduce(
        (n, c) => n + c.cards.filter((card) => card.owner.unassigned).length,
        0
      ),
    },
    diagnostics: {
      ...presentation.diagnostics,
      visibleLeadCount: visibleLeadIds.length,
      // Preserve sourceLeadCount / hiddenLeadCount from server window
    },
  };

  return {
    presentation: next,
    visibleLeadIds,
    enrichmentFilterApplied,
  };
}

/** Collect inactive-review cards across columns (flat list, oldest untouched first). */
export function collectInactiveReviewCards(
  presentation: PipelinePresentation,
  nowMs: number,
  inactiveAgeDays: number
): PipelineLeadCard[] {
  const q: PipelineOpsQueryState = {
    view: "inactive_review",
    sort: "oldest_untouched",
    lifecycle: null,
    stageSlug: null,
    age: null,
    ownerId: null,
    sourceKey: null,
    activity: null,
    inactiveAgeDays,
    userSortSelected: true,
  };
  const applied = applyPipelineOpsToPresentation(presentation, q, nowMs);
  const cards = applied.presentation.columns.flatMap((c) => c.cards);
  return sortPipelineCardsByOpsMode(cards, "oldest_untouched");
}
