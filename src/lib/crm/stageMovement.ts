import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  publishConsultationEvent,
  publishLeadFlowEvent,
} from "@/src/lib/analytics-os/analyticsModulePublishers";
import { createTimelineEvent } from "@/src/lib/fi/foundation/createTimelineEvent";
import { appendCrmActivityEvent } from "./activity";
import { mapFiCrmLeadRow } from "./leadRow";
import { loadPipelineStages } from "./pipeline";
import { appendCrmLeadStageHistory } from "./stageHistory";
import type { FiCrmLeadRow, FiCrmPipelineStageRow } from "./types";
import { DEFAULT_CRM_PIPELINE_KEY } from "./types";
import { stageRowMatchesOrgClinicScope } from "./scope";
import { normaliseOrgClinicScope } from "./scope";
import { assertNonEmptyUuid } from "./validation";

export type MoveCrmLeadToStageParams = {
  tenantId: string;
  leadId: string;
  toStageId: string;
  changedBy?: string | null;
  reason?: string | null;
  source?: string;
  /** When true (default), append fi_timeline_events when lead.case_id is set. */
  dualWriteTimelineWhenCasePresent?: boolean;
};

export type MoveCrmLeadToStageResult = {
  lead: FiCrmLeadRow;
  timelineEventId: string | null;
};

/**
 * Updates `current_stage_id`, appends `fi_crm_lead_stage_history`, and records `fi_crm_activity_events` (`stage.changed`).
 * Optionally dual-writes `fi_timeline_events` when the lead has `case_id`.
 */
export async function moveCrmLeadToStage(
  params: MoveCrmLeadToStageParams,
  client?: SupabaseClient
): Promise<MoveCrmLeadToStageResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId");
  const leadId = assertNonEmptyUuid(params.leadId, "leadId");
  const toStageId = assertNonEmptyUuid(params.toStageId, "toStageId");
  const source = (params.source ?? "user").trim() || "user";

  const { data: leadRow, error: leadErr } = await supabase
    .from("fi_crm_leads")
    .select("*")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .single();
  if (leadErr || !leadRow) throw new Error(leadErr?.message ?? "Lead not found for tenant.");

  const lead = leadRow as Record<string, unknown>;
  const fromStageId = lead.current_stage_id != null ? String(lead.current_stage_id) : null;
  if (fromStageId === toStageId) {
    return { lead: mapFiCrmLeadRow(lead), timelineEventId: null };
  }

  const { data: stageRow, error: stageErr } = await supabase
    .from("fi_crm_pipeline_stages")
    .select("*")
    .eq("id", toStageId)
    .eq("tenant_id", tenantId)
    .single();
  if (stageErr || !stageRow) throw new Error(stageErr?.message ?? "Target stage not found.");

  const toStage = stageRow as Record<string, unknown>;
  const orgClinic = normaliseOrgClinicScope({
    organisationId: lead.organisation_id as string | null | undefined,
    clinicId: lead.clinic_id as string | null | undefined,
  });
  const stage: FiCrmPipelineStageRow = {
    id: String(toStage.id),
    tenant_id: String(toStage.tenant_id),
    organisation_id: toStage.organisation_id != null ? String(toStage.organisation_id) : null,
    clinic_id: toStage.clinic_id != null ? String(toStage.clinic_id) : null,
    pipeline_key: String(toStage.pipeline_key),
    slug: String(toStage.slug),
    label: String(toStage.label),
    sort_order: Number(toStage.sort_order),
    is_entry: Boolean(toStage.is_entry),
    is_won: Boolean(toStage.is_won),
    is_lost: Boolean(toStage.is_lost),
    metadata:
      toStage.metadata && typeof toStage.metadata === "object" && !Array.isArray(toStage.metadata)
        ? (toStage.metadata as Record<string, unknown>)
        : {},
    created_at: String(toStage.created_at),
    updated_at: String(toStage.updated_at),
  };

  if (!stageRowMatchesOrgClinicScope(stage, orgClinic)) {
    const siblings = await loadPipelineStages(
      {
        tenantId,
        organisationId: orgClinic.organisationId,
        clinicId: orgClinic.clinicId,
        pipelineKey: stage.pipeline_key ?? DEFAULT_CRM_PIPELINE_KEY,
      },
      supabase
    );
    const allowed = siblings.some((s) => s.id === toStageId);
    if (!allowed) {
      throw new Error("Target stage is not in the same pipeline scope as the lead.");
    }
  }

  let timelineEventId: string | null = null;
  const dual = params.dualWriteTimelineWhenCasePresent !== false;
  const caseId = lead.case_id != null ? String(lead.case_id) : null;
  if (dual && caseId) {
    const tl = await createTimelineEvent(
      {
        tenant_id: tenantId,
        case_id: caseId,
        patient_id: lead.patient_id != null ? String(lead.patient_id) : null,
        person_id: lead.person_id != null ? String(lead.person_id) : null,
        organisation_id: lead.organisation_id != null ? String(lead.organisation_id) : null,
        clinic_id: lead.clinic_id != null ? String(lead.clinic_id) : null,
        event_type: "crm.lead.stage_changed",
        title: "CRM stage changed",
        metadata: {
          lead_id: leadId,
          from_stage_id: fromStageId,
          to_stage_id: toStageId,
        },
      },
      supabase
    );
    timelineEventId = tl.id;
  }

  await appendCrmLeadStageHistory(
    {
      tenantId,
      leadId,
      fromStageId,
      toStageId,
      changedBy: params.changedBy?.trim() || null,
      reason: params.reason?.trim() || null,
      source,
      fiTimelineEventId: timelineEventId,
      metadata: {},
    },
    supabase
  );

  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await supabase
    .from("fi_crm_leads")
    .update({ current_stage_id: toStageId, updated_at: now })
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (upErr) throw new Error(upErr.message);

  const outLead = mapFiCrmLeadRow(updated as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId,
      activityKind: "stage.changed",
      title: "Stage changed",
      detail: {
        from_stage_id: fromStageId,
        to_stage_id: toStageId,
        to_stage_slug: stage.slug,
      },
      fiTimelineEventId: timelineEventId,
      patientId: outLead.patient_id,
      caseId: outLead.case_id,
    },
    supabase
  );

  if (stage.slug === "quote_sent") {
    void publishConsultationEvent({
      tenantId,
      clinicId: outLead.clinic_id,
      eventType: "quote_sent",
      entityId: leadId,
      entityType: "lead",
      eventMetadata: {
        lead_id: leadId,
        case_id: outLead.case_id,
        patient_id: outLead.patient_id,
        to_stage_id: toStageId,
        source,
      },
    });
  }

  void publishLeadFlowEvent({
    tenantId,
    clinicId: outLead.clinic_id,
    eventType: "lead_stage_changed",
    entityId: leadId,
    entityType: "lead",
    eventMetadata: {
      from_stage_id: fromStageId,
      to_stage_id: toStageId,
      stage: stage.slug,
      source,
    },
  });

  if (/qualified/i.test(stage.slug)) {
    void publishLeadFlowEvent({
      tenantId,
      clinicId: outLead.clinic_id,
      eventType: "lead_qualified",
      entityId: leadId,
      entityType: "lead",
      eventMetadata: {
        stage: stage.slug,
        to_stage_id: toStageId,
      },
    });
  }

  return { lead: outLead, timelineEventId };
}
