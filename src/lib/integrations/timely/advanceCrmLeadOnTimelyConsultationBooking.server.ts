import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { timelyConsultationBookingEligibleForCrmAdvance } from "@/src/lib/crm/crmStageAutoAdvancePolicy";
import {
  advanceCrmLeadStageIfEarlier,
  type AdvanceCrmLeadStageIfEarlierResult,
} from "@/src/lib/crm/advanceCrmLeadStageIfEarlier.server";
import type { FiBookingRow } from "@/src/lib/bookings/types";

const TARGET_STAGE_SLUG = "consult_scheduled";
const REASON = "timely.consultation_booked";
const SOURCE = "timely";

export type TimelyBookingCrmStageAdvanceInput = {
  tenantId: string;
  leadId: string | null | undefined;
  booking: Pick<FiBookingRow, "booking_type" | "booking_status" | "cancelled_at">;
};

export async function advanceCrmLeadOnTimelyConsultationBooking(
  input: TimelyBookingCrmStageAdvanceInput,
  client?: SupabaseClient
): Promise<AdvanceCrmLeadStageIfEarlierResult> {
  if (!input.leadId?.trim()) {
    return { action: "skipped", stageSlug: null };
  }
  if (!timelyConsultationBookingEligibleForCrmAdvance(input.booking)) {
    return { action: "skipped", stageSlug: null };
  }

  return advanceCrmLeadStageIfEarlier(
    {
      tenantId: input.tenantId,
      leadId: input.leadId,
      targetStageSlug: TARGET_STAGE_SLUG,
      reason: REASON,
      source: SOURCE,
    },
    client
  );
}
