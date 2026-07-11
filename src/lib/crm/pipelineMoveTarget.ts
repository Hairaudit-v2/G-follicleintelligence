/**
 * FI-UX-REBUILD-1 S4.3A — pure grouped staff-column → backend stage destination resolver.
 *
 * Mutations must always receive a real `fi_crm_pipeline_stages.id`.
 * Staff-column IDs are never valid stage IDs.
 */

import {
  resolvePipelineStaffStage,
  type PipelineStaffColumnId,
  type PipelineStageDefinition,
} from "@/src/lib/crm/pipelineStaffModel";

export type PipelineMoveStageDefinition = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
  isEntry: boolean;
  isWon: boolean;
  isLost: boolean;
  archived?: boolean;
};

export type PipelineMoveTargetResolution =
  | {
      ok: true;
      stageId: string;
      slug: string;
      columnId: PipelineStaffColumnId;
    }
  | {
      ok: false;
      error:
        | "no_backend_stage_for_column"
        | "terminal_column_requires_special_action"
        | "invalid_stage_definition";
      columnId: PipelineStaffColumnId;
    };

const TERMINAL_SPECIAL: ReadonlySet<PipelineStaffColumnId> = new Set([
  "converted",
  "closed_lost",
]);

/**
 * Resolve the default backend entry stage for an active/holding staff column.
 * Converted / Closed-lost require convert / mark_lost actions — not ordinary moves.
 */
export function resolvePipelineColumnEntryStage(
  columnId: PipelineStaffColumnId,
  tenantStages: readonly PipelineMoveStageDefinition[]
): PipelineMoveTargetResolution {
  if (TERMINAL_SPECIAL.has(columnId)) {
    return {
      ok: false,
      error: "terminal_column_requires_special_action",
      columnId,
    };
  }

  const candidates: PipelineMoveStageDefinition[] = [];

  for (const stage of tenantStages) {
    if (!stage?.id?.trim()) {
      continue;
    }
    if (stage.archived) continue;
    if (!stage.slug?.trim()) continue;

    const asDef: PipelineStageDefinition = {
      id: stage.id,
      slug: stage.slug,
      label: stage.label,
      sortOrder: stage.sortOrder,
      isEntry: stage.isEntry,
      isWon: stage.isWon,
      isLost: stage.isLost,
      archived: stage.archived,
    };

    // Conflicting terminal flags → skip (invalid for destination)
    if (stage.isWon && stage.isLost) continue;

    const resolved = resolvePipelineStaffStage(asDef);
    // Only exact column match — never use fallback mapping into another column's destination
    if (resolved.columnId !== columnId) continue;
    // Fallback source means unknown slug parked in qualified — do not use as intentional destination
    // unless the stage truly maps via known_slug / flags / entry
    if (resolved.source === "fallback") continue;

    candidates.push(stage);
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "no_backend_stage_for_column",
      columnId,
    };
  }

  candidates.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const slugCmp = a.slug.localeCompare(b.slug);
    if (slugCmp !== 0) return slugCmp;
    return a.id.localeCompare(b.id);
  });

  const winner = candidates[0]!;
  if (!winner.id.trim() || winner.id === columnId) {
    return {
      ok: false,
      error: "invalid_stage_definition",
      columnId,
    };
  }

  return {
    ok: true,
    stageId: winner.id.trim(),
    slug: winner.slug.trim(),
    columnId,
  };
}

/** Active + holding columns that support ordinary Move stage destinations. */
export function pipelineMoveableStaffColumns(): readonly PipelineStaffColumnId[] {
  return [
    "new",
    "contacting",
    "qualified",
    "consultation",
    "planning_quote",
    "booked_deposit",
    "nurture",
  ] as const;
}
