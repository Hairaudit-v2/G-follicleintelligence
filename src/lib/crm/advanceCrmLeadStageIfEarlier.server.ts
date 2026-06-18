import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "./activity";
import { mapFiCrmLeadRow } from "./leadRow";
import { ensureDefaultPipelineStages } from "./pipeline";
import { moveCrmLeadToStage } from "./stageMovement";
import {
  findPipelineStageById,
  findPipelineStageBySlug,
  isTerminalCrmLeadStatus,
  shouldAdvanceCrmLeadToTargetSortOrder,
  type CrmStageAutoAdvanceAction,
} from "./crmStageAutoAdvancePolicy";
import { assertNonEmptyUuid } from "./validation";

export type AdvanceCrmLeadStageIfEarlierParams = {
  tenantId: string;
  leadId: string | null | undefined;
  targetStageSlug: string;
  reason: string;
  /** Activity + stage history source, e.g. `timely` or `consultation_os`. */
  source: string;
};

export type AdvanceCrmLeadStageIfEarlierResult = {
  action: CrmStageAutoAdvanceAction;
  stageSlug: string | null;
};

/**
 * Idempotently advances a CRM lead to `targetStageSlug` when its current pipeline stage is earlier.
 * Never downgrades. Skips when lead is missing or terminal.
 */
export async function advanceCrmLeadStageIfEarlier(
  params: AdvanceCrmLeadStageIfEarlierParams,
  client?: SupabaseClient
): Promise<AdvanceCrmLeadStageIfEarlierResult> {
  const leadIdRaw = params.leadId?.trim();
  if (!leadIdRaw) {
    return { action: "skipped", stageSlug: null };
  }

  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId");
  const leadId = assertNonEmptyUuid(leadIdRaw, "leadId");
  const targetSlug = params.targetStageSlug.trim();
  if (!targetSlug) {
    return { action: "skipped", stageSlug: null };
  }

  const { data: leadRow, error: leadErr } = await supabase
    .from("fi_crm_leads")
    .select("*")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  if (!leadRow) {
    return { action: "skipped", stageSlug: null };
  }

  const lead = mapFiCrmLeadRow(leadRow as Record<string, unknown>);
  if (isTerminalCrmLeadStatus(lead.status) || lead.converted_at?.trim()) {
    return { action: "skipped", stageSlug: null };
  }

  const { stages } = await ensureDefaultPipelineStages(
    {
      tenantId,
      organisationId: lead.organisation_id,
      clinicId: lead.clinic_id,
    },
    supabase
  );

  const targetStage = findPipelineStageBySlug(stages, targetSlug);
  if (!targetStage) {
    return { action: "skipped", stageSlug: null };
  }

  const currentStage = findPipelineStageById(stages, lead.current_stage_id);
  const currentSortOrder = currentStage?.sort_order ?? null;

  if (!shouldAdvanceCrmLeadToTargetSortOrder(currentSortOrder, targetStage.sort_order)) {
    return { action: "unchanged", stageSlug: targetStage.slug };
  }

  if (currentStage?.id === targetStage.id) {
    return { action: "unchanged", stageSlug: targetStage.slug };
  }

  const source = params.source.trim() || "system";
  const reason = params.reason.trim() || null;

  await moveCrmLeadToStage(
    {
      tenantId,
      leadId,
      toStageId: targetStage.id,
      changedBy: null,
      reason,
      source,
    },
    supabase
  );

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId,
      activityKind: "crm.stage.auto_advanced",
      title: "CRM stage auto-advanced",
      detail: {
        to_stage_slug: targetStage.slug,
        to_stage_id: targetStage.id,
        reason,
        source,
      },
      patientId: lead.patient_id,
      caseId: lead.case_id,
    },
    supabase
  );

  return { action: "advanced", stageSlug: targetStage.slug };
}
