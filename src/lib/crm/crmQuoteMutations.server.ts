import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { loadPipelineStages } from "@/src/lib/crm/pipeline";
import { moveCrmLeadToStage } from "@/src/lib/crm/stageMovement";
import { DEFAULT_CRM_PIPELINE_KEY } from "@/src/lib/crm/types";
import { normaliseOrgClinicScope } from "@/src/lib/crm/scope";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { createTimelineEvent } from "@/src/lib/fi/foundation/createTimelineEvent";

export type MarkCrmQuoteAcceptedResult = {
  quoteId: string;
  status: string;
  leadStageUpdated: boolean;
  reused: boolean;
  caseId: string | null;
  consultationId: string | null;
  leadId: string | null;
};

export async function markCrmQuoteAcceptedForTenant(
  args: {
    tenantId: string;
    quoteId: string;
    actorFiUserId?: string | null;
  },
  client?: SupabaseClient
): Promise<MarkCrmQuoteAcceptedResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const qid = assertNonEmptyUuid(args.quoteId, "quoteId");

  const { data: qRow, error: qe } = await supabase
    .from("fi_crm_quotes")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", qid)
    .maybeSingle();
  if (qe) throw new Error(qe.message);
  if (!qRow) throw new Error("Quote not found.");

  const status = String((qRow as { status?: unknown }).status ?? "").trim();
  const rowCaseId =
    (qRow as { case_id?: string | null }).case_id != null
      ? String((qRow as { case_id: string }).case_id)
      : null;
  const rowConsultationId =
    (qRow as { consultation_id?: string | null }).consultation_id != null
      ? String((qRow as { consultation_id: string }).consultation_id)
      : null;
  const rowLeadId =
    (qRow as { lead_id?: string | null }).lead_id != null
      ? String((qRow as { lead_id: string }).lead_id)
      : null;

  if (status === "accepted") {
    return {
      quoteId: qid,
      status: "accepted",
      leadStageUpdated: false,
      reused: true,
      caseId: rowCaseId,
      consultationId: rowConsultationId,
      leadId: rowLeadId,
    };
  }
  if (status === "declined" || status === "expired" || status === "cancelled") {
    throw new Error(`Cannot accept quote in status "${status}".`);
  }

  const now = new Date().toISOString();
  const { error: ue } = await supabase
    .from("fi_crm_quotes")
    .update({ status: "accepted", responded_at: now, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", qid);
  if (ue) throw new Error(ue.message);

  const leadId = rowLeadId;
  const caseId = rowCaseId;
  const consultationId = rowConsultationId;

  let leadStageUpdated = false;

  if (leadId) {
    await appendCrmActivityEvent(
      {
        tenantId: tid,
        leadId,
        activityKind: "quote.accepted",
        title: "Quote accepted",
        detail: { quote_id: qid, consultation_id: consultationId, case_id: caseId },
        occurredAt: now,
        patientId: null,
        caseId,
      },
      supabase
    );

    const { data: leadRaw, error: le } = await supabase
      .from("fi_crm_leads")
      .select("*")
      .eq("tenant_id", tid)
      .eq("id", leadId)
      .maybeSingle();
    if (!le && leadRaw) {
      const lead = leadRaw as Record<string, unknown>;
      const orgClinic = normaliseOrgClinicScope({
        organisationId: lead.organisation_id as string | null | undefined,
        clinicId: lead.clinic_id as string | null | undefined,
      });
      const stages = await loadPipelineStages(
        {
          tenantId: tid,
          organisationId: orgClinic.organisationId,
          clinicId: orgClinic.clinicId,
          pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
        },
        supabase
      );
      const currentId = lead.current_stage_id != null ? String(lead.current_stage_id) : null;
      const currentSlug = currentId ? stages.find((s) => s.id === currentId)?.slug : null;
      const depositStage = stages.find((s) => s.slug === "deposit_or_booked");
      if (currentSlug === "quote_sent" && depositStage) {
        await moveCrmLeadToStage(
          {
            tenantId: tid,
            leadId,
            toStageId: depositStage.id,
            changedBy: args.actorFiUserId?.trim() || null,
            reason: "Quote accepted (FI OS)",
            source: "quote_accepted",
          },
          supabase
        );
        leadStageUpdated = true;
      }
    }
  }

  if (caseId) {
    const { data: kase, error: ke } = await supabase
      .from("fi_cases")
      .select("foundation_patient_id, patient_id")
      .eq("tenant_id", tid)
      .eq("id", caseId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!ke && kase) {
      const fp = (kase as { foundation_patient_id?: string | null }).foundation_patient_id;
      const patientId = fp != null && String(fp).trim() ? String(fp).trim() : null;
      if (patientId) {
        await createTimelineEvent(
          {
            tenant_id: tid,
            case_id: caseId,
            patient_id: patientId,
            event_type: "crm.quote.accepted",
            title: "Quote accepted",
            metadata: {
              quote_id: qid,
              consultation_id: consultationId,
            },
          },
          supabase
        );
      }
    }
  }

  return {
    quoteId: qid,
    status: "accepted",
    leadStageUpdated,
    reused: false,
    caseId,
    consultationId,
    leadId,
  };
}
