/**
 * FI-PIPELINE-OPERATIONS-1 — pure safe desktop drag destination rules.
 *
 * Does not perform mutations. Resolves staff-column drops to backend stage UUIDs
 * via existing pipelineMoveTarget resolver.
 */

import {
  resolvePipelineColumnEntryStage,
  type PipelineMoveStageDefinition,
} from "@/src/lib/crm/pipelineMoveTarget";
import type { PipelineStaffColumnId } from "@/src/lib/crm/pipelineStaffModel";
import { PIPELINE_STAFF_COLUMN_ORDER } from "@/src/lib/crm/pipelineStaffModel";

export type PipelineDragDropIntent =
  | {
      kind: "move";
      leadId: string;
      fromColumnId: PipelineStaffColumnId;
      toColumnId: PipelineStaffColumnId;
      /** Real backend stage UUID — never a staff-column id. */
      toStageId: string;
      toStageSlug: string;
    }
  | {
      kind: "open_lost_reason";
      leadId: string;
      fromColumnId: PipelineStaffColumnId;
      toColumnId: "closed_lost";
    }
  | {
      kind: "open_conversion";
      leadId: string;
      fromColumnId: PipelineStaffColumnId;
      toColumnId: "converted";
    }
  | {
      kind: "open_booked_workflow";
      leadId: string;
      fromColumnId: PipelineStaffColumnId;
      toColumnId: "booked_deposit";
    }
  | {
      kind: "reject";
      leadId: string;
      reason:
        | "same_column"
        | "read_only"
        | "tablet_or_touch"
        | "archived_destination"
        | "invalid_destination"
        | "no_stage"
        | "staff_column_id_leak";
    };

export type ResolvePipelineDragDropInput = {
  leadId: string;
  fromColumnId: PipelineStaffColumnId;
  toColumnId: PipelineStaffColumnId;
  tenantStages: readonly PipelineMoveStageDefinition[];
  canMutate: boolean;
  /** Desktop pointer only — false for tablet/phone / coarse pointer. */
  desktopPointer: boolean;
  /**
   * When true, booked_deposit requires booking/deposit workflow instead of blind move.
   * Default true for safety.
   */
  bookedRequiresWorkflow?: boolean;
};

/**
 * Resolve a drop. Never returns a staff-column id as toStageId.
 */
export function resolvePipelineDragDrop(
  input: ResolvePipelineDragDropInput
): PipelineDragDropIntent {
  const leadId = input.leadId.trim();
  if (!leadId) {
    return { kind: "reject", leadId: "", reason: "invalid_destination" };
  }

  if (!input.canMutate) {
    return { kind: "reject", leadId, reason: "read_only" };
  }

  if (!input.desktopPointer) {
    return { kind: "reject", leadId, reason: "tablet_or_touch" };
  }

  if (input.fromColumnId === input.toColumnId) {
    return { kind: "reject", leadId, reason: "same_column" };
  }

  if (!PIPELINE_STAFF_COLUMN_ORDER.includes(input.toColumnId)) {
    return { kind: "reject", leadId, reason: "invalid_destination" };
  }

  if (input.toColumnId === "closed_lost") {
    return {
      kind: "open_lost_reason",
      leadId,
      fromColumnId: input.fromColumnId,
      toColumnId: "closed_lost",
    };
  }

  if (input.toColumnId === "converted") {
    return {
      kind: "open_conversion",
      leadId,
      fromColumnId: input.fromColumnId,
      toColumnId: "converted",
    };
  }

  if (input.toColumnId === "booked_deposit" && input.bookedRequiresWorkflow !== false) {
    return {
      kind: "open_booked_workflow",
      leadId,
      fromColumnId: input.fromColumnId,
      toColumnId: "booked_deposit",
    };
  }

  const resolved = resolvePipelineColumnEntryStage(input.toColumnId, input.tenantStages);
  if (!resolved.ok) {
    if (resolved.error === "no_backend_stage_for_column") {
      return { kind: "reject", leadId, reason: "no_stage" };
    }
    if (resolved.error === "terminal_column_requires_special_action") {
      return { kind: "reject", leadId, reason: "invalid_destination" };
    }
    return { kind: "reject", leadId, reason: "invalid_destination" };
  }

  // Guard: never allow staff-column id as stage id
  if (
    !resolved.stageId.trim() ||
    resolved.stageId === input.toColumnId ||
    PIPELINE_STAFF_COLUMN_ORDER.includes(resolved.stageId as PipelineStaffColumnId)
  ) {
    return { kind: "reject", leadId, reason: "staff_column_id_leak" };
  }

  // Archived stages already skipped by resolver; double-check target stage not archived
  const stageRow = input.tenantStages.find((s) => s.id === resolved.stageId);
  if (stageRow?.archived) {
    return { kind: "reject", leadId, reason: "archived_destination" };
  }

  return {
    kind: "move",
    leadId,
    fromColumnId: input.fromColumnId,
    toColumnId: input.toColumnId,
    toStageId: resolved.stageId,
    toStageSlug: resolved.slug,
  };
}

/** Whether drag should be enabled for current viewport (desktop coarse-pointer guard). */
export function isPipelineDesktopDragEnabled(opts: {
  canMutate: boolean;
  /** matchMedia('(pointer: fine) and (min-width: 1024px)') */
  finePointerDesktop: boolean;
}): boolean {
  return opts.canMutate && opts.finePointerDesktop;
}

export type PipelineDragSession = {
  leadId: string;
  fromColumnId: PipelineStaffColumnId;
};

/** Only one card drag at a time — pure reducer helper. */
export function startPipelineDragSession(
  current: PipelineDragSession | null,
  next: PipelineDragSession
): PipelineDragSession {
  // Replace any existing session (one at a time)
  return { leadId: next.leadId.trim(), fromColumnId: next.fromColumnId };
}

export function clearPipelineDragSession(): null {
  return null;
}
