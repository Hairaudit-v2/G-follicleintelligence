/**
 * FI-UX-REBUILD-1 S4.4 — pure legacy ↔ Pipeline dual-run comparison (no PHI).
 */

import {
  PIPELINE_DEFAULT_STAGE_CROSSWALK,
  resolvePipelineStaffStage,
  type PipelineStaffColumnId,
  type PipelineStageDefinition,
} from "@/src/lib/crm/pipelineStaffModel";
import type { PipelinePresentation } from "@/src/lib/crm/pipelinePresentation.types";
import type { CrmKanbanLeadCard, FiCrmPipelineStageRow } from "@/src/lib/crm/types";

// ---------------------------------------------------------------------------
// Approved intentional-difference reason codes
// ---------------------------------------------------------------------------

export const PIPELINE_DUAL_RUN_APPROVED_REASONS = new Set([
  "grouped_backend_stage",
  "nurture_holding_lane",
  "terminal_column_collapsed",
  "urgency_as_badge",
  "follow_ups_as_task_buckets",
  "communication_hint_after_task",
  "analytics_omitted",
  "list_columns_omitted",
  "unknown_stage_fallback",
  "next_action_not_in_legacy",
  "consultation_not_in_legacy_board",
] as const);

export type PipelineDualRunApprovedReason =
  typeof PIPELINE_DUAL_RUN_APPROVED_REASONS extends Set<infer T> ? T : never;

export function isPipelineDualRunReasonApproved(
  reason: string | null | undefined
): reason is PipelineDualRunApprovedReason {
  if (!reason) return false;
  return PIPELINE_DUAL_RUN_APPROVED_REASONS.has(reason as PipelineDualRunApprovedReason);
}

// ---------------------------------------------------------------------------
// Comparison output
// ---------------------------------------------------------------------------

export type PipelineStageMismatch = {
  leadId: string;
  backendStageSlug: string | null;
  pipelineColumnId: PipelineStaffColumnId;
  expected: boolean;
  reason: string | null;
};

export type PipelineNextActionMismatch = {
  leadId: string;
  legacyDueAtIso: string | null;
  pipelineDueAtIso: string | null;
  expected: boolean;
  reason: string;
};

export type PipelineDualRunComparison = {
  tenantId: string;
  generatedAt: string;

  legacyLeadIds: string[];
  pipelineLeadIds: string[];

  missingFromPipeline: string[];
  extraInPipeline: string[];
  duplicatePipelineLeadIds: string[];

  stageMismatches: PipelineStageMismatch[];
  ownerMismatches: string[];
  nextActionMismatches: PipelineNextActionMismatch[];

  overdueMismatches: string[];
  consultationMismatches: string[];
  conversionMismatches: string[];

  orphanTaskIds: string[];
  hiddenLeadCount: number;

  pass: boolean;
};

export type ComparePipelineDualRunInput = {
  legacyCards: readonly CrmKanbanLeadCard[];
  legacyStages: readonly FiCrmPipelineStageRow[];
  pipeline: PipelinePresentation;
  tenantId: string;
  nowMs: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortedUnique(ids: readonly string[]): string[] {
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
}

function pipelineCardByLeadId(
  pipeline: PipelinePresentation
): Map<string, import("@/src/lib/crm/pipelinePresentation.types").PipelineLeadCard> {
  const map = new Map<
    string,
    import("@/src/lib/crm/pipelinePresentation.types").PipelineLeadCard
  >();
  for (const col of pipeline.columns) {
    for (const card of col.cards) {
      map.set(card.leadId, card);
    }
  }
  return map;
}

function stageDefFromLegacyCard(card: CrmKanbanLeadCard): PipelineStageDefinition | null {
  const slug = card.stage?.slug?.trim();
  if (!slug) return null;
  return {
    id: card.stage?.id,
    slug,
    label: card.stage?.label ?? slug,
    sortOrder: card.stage?.sort_order ?? 0,
    isEntry: false,
    isWon: slug === "won_closed",
    isLost: slug === "lost",
  };
}

function legacyConversionState(card: CrmKanbanLeadCard): string {
  const status = String(card.lead.status ?? "open").trim().toLowerCase();
  const slug = card.stage?.slug?.trim().toLowerCase() ?? "";
  // Legacy kanban placement uses terminal stage columns — align comparator with board evidence.
  const stageWon = slug === "won_closed";
  const stageLost = slug === "lost";

  if (card.lead.converted_at || status === "converted" || stageWon) return "converted";
  if (status === "lost" || stageLost) return "lost";
  if (status === "archived") return "archived";
  return "active";
}

function pipelineConversionState(
  card: import("@/src/lib/crm/pipelinePresentation.types").PipelineLeadCard
): string {
  return card.conversion.state;
}

function classifyStageMatch(
  legacyCard: CrmKanbanLeadCard,
  pipelineColumnId: PipelineStaffColumnId
): PipelineStageMismatch {
  const slug = legacyCard.stage?.slug ?? null;
  const stageDef = stageDefFromLegacyCard(legacyCard);
  const resolved = stageDef
    ? resolvePipelineStaffStage(stageDef)
    : resolvePipelineStaffStage({
        slug: "qualified",
        label: "Qualified",
        sortOrder: 0,
        isEntry: false,
        isWon: false,
        isLost: false,
      });

  const matches = resolved.columnId === pipelineColumnId;

  if (matches) {
    if (resolved.source === "fallback") {
      return {
        leadId: legacyCard.lead.id,
        backendStageSlug: slug,
        pipelineColumnId,
        expected: true,
        reason: "unknown_stage_fallback",
      };
    }
    const grouped =
      slug &&
      PIPELINE_DEFAULT_STAGE_CROSSWALK[slug] === pipelineColumnId &&
      slug !== pipelineColumnId;
    if (grouped) {
      return {
        leadId: legacyCard.lead.id,
        backendStageSlug: slug,
        pipelineColumnId,
        expected: true,
        reason: "grouped_backend_stage",
      };
    }
    if (pipelineColumnId === "nurture") {
      return {
        leadId: legacyCard.lead.id,
        backendStageSlug: slug,
        pipelineColumnId,
        expected: true,
        reason: "nurture_holding_lane",
      };
    }
    return {
      leadId: legacyCard.lead.id,
      backendStageSlug: slug,
      pipelineColumnId,
      expected: true,
      reason: null,
    };
  }

  return {
    leadId: legacyCard.lead.id,
    backendStageSlug: slug,
    pipelineColumnId,
    expected: false,
    reason: null,
  };
}

// ---------------------------------------------------------------------------
// Main comparator
// ---------------------------------------------------------------------------

export function comparePipelineDualRun(input: ComparePipelineDualRunInput): PipelineDualRunComparison {
  const legacyLeadIds = sortedUnique(input.legacyCards.map((c) => c.lead.id));

  const pipelineIdsRaw: string[] = [];
  for (const col of input.pipeline.columns) {
    for (const card of col.cards) pipelineIdsRaw.push(card.leadId);
  }
  const pipelineLeadIds = sortedUnique(pipelineIdsRaw);

  const pipelineSet = new Set(pipelineLeadIds);
  const legacySet = new Set(legacyLeadIds);

  const missingFromPipeline = legacyLeadIds.filter((id) => !pipelineSet.has(id));
  const extraInPipeline = pipelineLeadIds.filter((id) => !legacySet.has(id));

  const idCounts = new Map<string, number>();
  for (const id of pipelineIdsRaw) {
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  const duplicatePipelineLeadIds = sortedUnique(
    Array.from(idCounts.entries())
      .filter(([, n]) => n > 1)
      .map(([id]) => id)
  );

  const cardMap = pipelineCardByLeadId(input.pipeline);

  const stageMismatches: PipelineStageMismatch[] = [];
  const ownerMismatches: string[] = [];
  const nextActionMismatches: PipelineNextActionMismatch[] = [];
  const overdueMismatches: string[] = [];
  const consultationMismatches: string[] = [];
  const conversionMismatches: string[] = [];

  for (const legacy of input.legacyCards) {
    const leadId = legacy.lead.id;
    const pCard = cardMap.get(leadId);
    if (!pCard) continue;

    const stageEntry = classifyStageMatch(legacy, pCard.stage.staffColumnId);
    if (!stageEntry.expected || stageEntry.reason) {
      stageMismatches.push(stageEntry);
    }

    const legacyOwner = legacy.lead.primary_owner_user_id?.trim() ?? null;
    const pipelineOwner = pCard.owner.userId?.trim() ?? null;
    if (legacyOwner !== pipelineOwner) {
      ownerMismatches.push(leadId);
    }

    const legacyOverdue = legacy.overdueTaskCount ?? 0;
    const pipelineOverdue = pCard.followUps.overdueCount ?? 0;
    if (input.pipeline.loadTier === "full" && legacyOverdue !== pipelineOverdue) {
      overdueMismatches.push(leadId);
    }

    const legacyConv = legacyConversionState(legacy);
    const pipelineConv = pipelineConversionState(pCard);
    if (legacyConv !== pipelineConv) {
      conversionMismatches.push(leadId);
    }

    const legacyPatient = legacy.lead.patient_id?.trim() ?? null;
    const pipelinePatient = pCard.conversion.patientId?.trim() ?? null;
    if (legacyConv === "converted" && legacyPatient !== pipelinePatient) {
      if (!conversionMismatches.includes(leadId)) conversionMismatches.push(leadId);
    }

    if (pCard.nextAction.kind === "communication_hint") {
      nextActionMismatches.push({
        leadId,
        legacyDueAtIso: null,
        pipelineDueAtIso: pCard.nextAction.dueAtIso,
        expected: true,
        reason: "communication_hint_after_task",
      });
    } else if (pCard.nextAction.dueAtIso) {
      nextActionMismatches.push({
        leadId,
        legacyDueAtIso: null,
        pipelineDueAtIso: pCard.nextAction.dueAtIso,
        expected: true,
        reason: "next_action_not_in_legacy",
      });
    }

    // Legacy kanban board does not surface consultation state — not compared.
  }

  void input.legacyStages;

  const hardStageFails = stageMismatches.filter((m) => !m.expected);
  const hardNextActionFails = nextActionMismatches.filter(
    (m) => m.expected && !isPipelineDualRunReasonApproved(m.reason)
  );

  const pass =
    missingFromPipeline.length === 0 &&
    extraInPipeline.length === 0 &&
    duplicatePipelineLeadIds.length === 0 &&
    hardStageFails.length === 0 &&
    ownerMismatches.length === 0 &&
    overdueMismatches.length === 0 &&
    conversionMismatches.length === 0 &&
    hardNextActionFails.length === 0;

  return {
    tenantId: input.tenantId.trim(),
    generatedAt: new Date(input.nowMs).toISOString(),
    legacyLeadIds,
    pipelineLeadIds,
    missingFromPipeline,
    extraInPipeline,
    duplicatePipelineLeadIds,
    stageMismatches,
    ownerMismatches,
    nextActionMismatches,
    overdueMismatches,
    consultationMismatches,
    conversionMismatches,
    orphanTaskIds: [...input.pipeline.diagnostics.orphanTaskIds].sort((a, b) =>
      a.localeCompare(b)
    ),
    hiddenLeadCount: input.pipeline.diagnostics.hiddenLeadCount,
    pass,
  };
}

/** Returns true when comparison JSON contains no obvious PHI patterns. */
export function pipelineDualRunContainsPhi(comparison: PipelineDualRunComparison): boolean {
  const json = JSON.stringify(comparison);
  if (/\S+@\S+\.\S+/.test(json)) return true;
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(json)) return true;
  const forbiddenKeys = ["displayName", "email", "phone", "subject", "preview", "body", "note_body"];
  for (const k of forbiddenKeys) {
    if (json.includes(`"${k}"`)) return true;
  }
  return false;
}
