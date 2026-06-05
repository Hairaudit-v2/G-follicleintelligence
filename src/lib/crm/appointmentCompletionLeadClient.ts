"use client";

import { crmMoveLeadStageAction, updateCrmLeadDetailsAction } from "@/lib/actions/fi-crm-actions";
import type { FiCrmLeadRow } from "./types";

export type AppointmentCompletionLeadOpts = {
  advanceStage: boolean;
  toStageId: string | null;
  treatmentValue: string;
  conversionProbability: string;
};

const MUTATION_SOURCE = "fi_admin_appointment_complete";

/**
 * Optional CRM updates after an appointment is marked complete.
 */
export async function applyLeadUpdatesAfterAppointmentComplete(
  tenantId: string,
  lead: FiCrmLeadRow,
  opts: AppointmentCompletionLeadOpts,
  operatorFiUserId: string
): Promise<{ stageError: string | null; metadataError: string | null }> {
  let stageError: string | null = null;
  let metadataError: string | null = null;

  if (opts.advanceStage && opts.toStageId?.trim()) {
    const r = await crmMoveLeadStageAction(tenantId, lead.id, {
      toStageId: opts.toStageId.trim(),
      changedBy: operatorFiUserId,
      reason: "Appointment marked complete",
      source: MUTATION_SOURCE,
    });
    if (!r.ok) stageError = r.error;
  }

  const tv = opts.treatmentValue.trim();
  const cp = opts.conversionProbability.trim();
  if (tv || cp) {
    const metadata = { ...(lead.metadata ?? {}) };
    if (tv) metadata.treatment_value = tv;
    if (cp) metadata.conversion_probability = cp.endsWith("%") ? cp : `${cp}%`;

    const r = await updateCrmLeadDetailsAction(tenantId, lead.id, {
      summary: lead.summary?.trim() || "Lead",
      status: lead.status,
      priority: lead.priority,
      primaryOwnerUserId: lead.primary_owner_user_id,
      organisationId: lead.organisation_id,
      clinicId: lead.clinic_id,
      metadata,
    });
    if (!r.ok) metadataError = r.error;
  }

  return { stageError, metadataError };
}
