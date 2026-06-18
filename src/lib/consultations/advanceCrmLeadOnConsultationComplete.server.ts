import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  advanceCrmLeadStageIfEarlier,
  type AdvanceCrmLeadStageIfEarlierResult,
} from "@/src/lib/crm/advanceCrmLeadStageIfEarlier.server";
import { consultationEligibleForCrmCompleteAdvance } from "@/src/lib/crm/crmStageAutoAdvancePolicy";
import type { ConsultationRow } from "./consultationTypes";

const TARGET_STAGE_SLUG = "consult_completed";
const REASON = "consultation.completed";
const SOURCE = "consultation_os";

/**
 * After a consultation reaches a terminal completion status, advance linked CRM lead when eligible.
 */
export async function advanceCrmLeadOnConsultationComplete(
  tenantId: string,
  consultation: Pick<ConsultationRow, "lead_id" | "status">,
  client?: SupabaseClient
): Promise<AdvanceCrmLeadStageIfEarlierResult> {
  if (!consultationEligibleForCrmCompleteAdvance(consultation)) {
    return { action: "skipped", stageSlug: null };
  }

  return advanceCrmLeadStageIfEarlier(
    {
      tenantId,
      leadId: consultation.lead_id,
      targetStageSlug: TARGET_STAGE_SLUG,
      reason: REASON,
      source: SOURCE,
    },
    client
  );
}
