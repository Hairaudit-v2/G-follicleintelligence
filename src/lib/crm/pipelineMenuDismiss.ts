/**
 * FI-PIPELINE-MORE-HYDRATION-RACE-FIX — stable menu dismissal key contract.
 *
 * The board clears openMenuLeadId only when this key changes. It must not
 * incorporate presentation.generatedAt or loadTier (shell→full hydrate).
 */

import type { PipelineWorkspaceView } from "@/src/lib/crm/pipelineUiHelpers";

export type PipelineMenuDismissEpochReason =
  | "explicit_refresh"
  | "mutation_refresh";

/** `${view}:${epoch}` — view change closes menus without bumping epoch. */
export function buildPipelineMenuDismissKey(
  view: PipelineWorkspaceView,
  epoch: number
): string {
  return `${view}:${epoch}`;
}

/** Shell→full hydrate must not advance the dismissal epoch. */
export function shouldBumpMenuDismissEpochOnPresentationApply(
  mode: "hydrate" | "refresh"
): boolean {
  return mode === "refresh";
}

/** Collect lead ids currently rendered on the board (for card-removal checks). */
export function collectPipelineBoardLeadIds(
  columns: ReadonlyArray<{ cards: ReadonlyArray<{ leadId: string }> }>
): Set<string> {
  const ids = new Set<string>();
  for (const col of columns) {
    for (const card of col.cards) {
      ids.add(card.leadId);
    }
  }
  return ids;
}

export function isOpenMenuLeadStillOnBoard(
  openMenuLeadId: string | null,
  columns: ReadonlyArray<{ cards: ReadonlyArray<{ leadId: string }> }>
): boolean {
  if (!openMenuLeadId) return true;
  return collectPipelineBoardLeadIds(columns).has(openMenuLeadId);
}