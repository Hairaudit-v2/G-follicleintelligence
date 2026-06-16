import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { upsertSurgeryPlanForCase } from "@/src/lib/cases/surgeryPlanningUpdate";
import { loadConsultationForTenant } from "@/src/lib/consultations/consultationLoaders.server";
import { parseMoneyStringToCentsAud } from "@/src/lib/revenueOs/quoteAmountParse";
import { createCrmTask } from "@/src/lib/crm/tasks";
import { createPathologyRequest } from "@/src/lib/pathology/pathologyRequestMutations.server";

import type { ConsultationCompletionSummary } from "../completion/consultationCompletionTypes";
import { loadConsultationFormInstance } from "../consultationFormLoad.server";
import {
  addBusinessDaysUtc,
  buildFollowUpTaskDescription,
  buildQuoteDraftNotesText,
  buildSurgeryHandoffStrategyNotes,
  followUpTaskRecommended,
  followUpTaskTitleForOutcome,
  handoffIdempotencyMetadata,
  pathologyHandoffRecommended,
  pathologyTemplateForOutcome,
  quoteDraftTitle,
  surgeryPlanningHandoffEligible,
} from "./consultationHandoffPure";
import type { ConsultationHandoffBaseInput, ConsultationHandoffMutationResult } from "./consultationHandoffTypes";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function parseCompletionSummary(raw: unknown): ConsultationCompletionSummary | null {
  const o = asRecord(raw);
  if (!o.consultationId || !o.formInstanceId || o.source !== "rules_v1") return null;
  return o as unknown as ConsultationCompletionSummary;
}

export async function requireLockedHandoffContext(
  tenantId: string,
  consultationId: string,
  formInstanceId: string
): Promise<{ summary: ConsultationCompletionSummary; consultation: NonNullable<Awaited<ReturnType<typeof loadConsultationForTenant>>> }> {
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  const fid = formInstanceId.trim();
  if (!tid || !cid || !fid) throw new Error("tenantId, consultationId, and formInstanceId are required.");

  const inst = await loadConsultationFormInstance(tid, fid);
  if (!inst) throw new Error("Form instance not found.");
  if (String(inst.consultation_id) !== cid) throw new Error("Form instance does not belong to this consultation.");
  if (inst.status !== "locked" || !inst.completed_at) {
    throw new Error("Complete the guided consultation before running handoffs.");
  }
  const summary = parseCompletionSummary(inst.completion_summary);
  if (!summary) throw new Error("Missing or invalid completion summary on this form instance.");

  const consultation = await loadConsultationForTenant(tid, cid);
  if (!consultation) throw new Error("Consultation not found.");
  return { summary, consultation };
}

function leadTasksHref(tenantId: string, leadId: string): string {
  return `/fi-admin/${tenantId}/crm/leads/${leadId}`;
}

function pathologyHref(tenantId: string, patientId: string, requestId: string): string {
  return `/fi-admin/${tenantId}/patients/${patientId}/blood-request/${requestId}`;
}

function caseHref(tenantId: string, caseId: string): string {
  return `/fi-admin/${tenantId}/cases/${caseId}`;
}

export async function createConsultationFollowUpTaskFromSummary(
  input: ConsultationHandoffBaseInput,
  client?: SupabaseClient
): Promise<ConsultationHandoffMutationResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const cid = input.consultationId.trim();
  const fid = input.formInstanceId.trim();

  const { summary, consultation } = await requireLockedHandoffContext(tid, cid, fid);

  if (!followUpTaskRecommended(summary)) {
    throw new Error("Follow-up task is not indicated for this completion summary.");
  }

  const leadId = consultation.lead_id?.trim();
  if (!leadId) {
    throw new Error("Link a CRM lead on the consultation to create a follow-up task.");
  }

  const { data: dup, error: dupErr } = await supabase
    .from("fi_crm_tasks")
    .select("id")
    .eq("tenant_id", tid)
    .eq("lead_id", leadId)
    .eq("consultation_id", cid)
    .contains("metadata", handoffIdempotencyMetadata(fid, "consultation_completion"))
    .in("status", ["open", "in_progress", "blocked"])
    .maybeSingle();
  if (dupErr) throw new Error(dupErr.message);
  if (dup?.id) {
    return { id: String((dup as { id: string }).id), reused: true, href: leadTasksHref(tid, leadId) };
  }

  const dueAt = addBusinessDaysUtc(new Date(), 2).toISOString();
  const title = followUpTaskTitleForOutcome(summary.outcomeType);
  const description = buildFollowUpTaskDescription(summary);
  const metadata = {
    ...handoffIdempotencyMetadata(fid, "consultation_completion"),
    outcomeType: summary.outcomeType,
  };

  const task = await createCrmTask(
    {
      tenantId: tid,
      leadId,
      title,
      description,
      taskType: "follow_up",
      status: "open",
      dueAt,
      patientId: consultation.patient_id?.trim() || null,
      caseId: consultation.case_id?.trim() || null,
      consultationId: cid,
      assigneeUserId: input.actorUserId?.trim() || null,
      metadata,
    },
    supabase
  );

  return { id: task.id, reused: false, href: leadTasksHref(tid, leadId) };
}

export async function createConsultationQuoteDraftFromSummary(
  input: ConsultationHandoffBaseInput,
  client?: SupabaseClient
): Promise<ConsultationHandoffMutationResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const cid = input.consultationId.trim();
  const fid = input.formInstanceId.trim();

  const { summary, consultation } = await requireLockedHandoffContext(tid, cid, fid);

  const leadId = consultation.lead_id?.trim() || null;
  const caseId = consultation.case_id?.trim() || null;
  if (!leadId && !caseId) {
    throw new Error("Link a CRM lead or case on the consultation to create a quote draft.");
  }

  const { data: existingQuote, error: qe } = await supabase
    .from("fi_crm_quotes")
    .select("id")
    .eq("tenant_id", tid)
    .eq("consultation_id", cid)
    .eq("status", "draft")
    .contains("metadata", handoffIdempotencyMetadata(fid, "consultation_quote_draft"))
    .maybeSingle();
  if (qe) throw new Error(qe.message);
  if (existingQuote?.id) {
    const qid = String((existingQuote as { id: string }).id);
    return {
      id: qid,
      reused: true,
      href: leadId ? leadTasksHref(tid, leadId) : caseHref(tid, caseId!),
      detail: "Existing draft quote for this consultation.",
    };
  }

  const title = quoteDraftTitle(summary);
  const notes = buildQuoteDraftNotesText(summary);
  const lineItems = [
    {
      kind: "consultation_summary",
      title,
      description: notes,
    },
  ];

  const pricePanel = String(consultation.quote_data?.price_quoted ?? "").trim();
  const priceCents = parseMoneyStringToCentsAud(pricePanel);
  const subtotalAud = priceCents != null && priceCents > 0 ? priceCents / 100 : null;

  const metadata = {
    ...handoffIdempotencyMetadata(fid, "consultation_quote_draft"),
    outcomeType: summary.outcomeType,
    estimated_grafts_min: summary.estimatedGraftsMin,
    estimated_grafts_max: summary.estimatedGraftsMax,
    recommended_zones: summary.recommendedZones,
    recommended_treatments: summary.recommendedTreatments,
    quote_title: title,
    quote_notes: notes,
    price_quoted_hint: pricePanel || null,
  };

  const { data: ins, error: ie } = await supabase
    .from("fi_crm_quotes")
    .insert({
      tenant_id: tid,
      lead_id: leadId,
      case_id: caseId,
      consultation_id: cid,
      status: "draft",
      line_items_snapshot: lineItems,
      subtotal_amount: subtotalAud,
      total_amount: subtotalAud,
      metadata,
    })
    .select("id")
    .single();
  if (ie) throw new Error(ie.message);

  const id = String((ins as { id: string }).id);
  return {
    id,
    reused: false,
    href: leadId ? leadTasksHref(tid, leadId) : caseHref(tid, caseId!),
    detail: "Draft quote created — open the lead or case in CRM to continue.",
  };
}

export async function createConsultationPathologyRecommendationFromSummary(
  input: ConsultationHandoffBaseInput,
  client?: SupabaseClient
): Promise<ConsultationHandoffMutationResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const cid = input.consultationId.trim();
  const fid = input.formInstanceId.trim();

  const { summary, consultation } = await requireLockedHandoffContext(tid, cid, fid);

  if (!pathologyHandoffRecommended(summary)) {
    throw new Error("Pathology / screening was not flagged for this consultation summary.");
  }

  const patientId = consultation.patient_id?.trim();
  if (!patientId) {
    throw new Error("Link a patient on the consultation before preparing a pathology request.");
  }

  const { data: dup, error: dupErr } = await supabase
    .from("fi_pathology_requests")
    .select("id")
    .eq("tenant_id", tid)
    .eq("patient_id", patientId)
    .eq("consultation_id", cid)
    .eq("form_instance_id", fid)
    .eq("status", "saved")
    .maybeSingle();
  if (dupErr) throw new Error(dupErr.message);
  if (dup?.id) {
    const rid = String((dup as { id: string }).id);
    return { id: rid, reused: true, href: pathologyHref(tid, patientId, rid) };
  }

  const template = pathologyTemplateForOutcome(summary.outcomeType);
  const clinicalNotes = [
    summary.pathologyReason.trim() ? `Reason: ${summary.pathologyReason.trim()}` : null,
    summary.riskFlags.length ? `Risk flags: ${summary.riskFlags.join(", ")}` : null,
    `Outcome: ${summary.outcomeType}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const requestMetadata = {
    source: "consultation_completion",
    form_instance_id: fid,
    consultation_id: cid,
    outcomeType: summary.outcomeType,
    pathologyReason: summary.pathologyReason,
    riskFlags: summary.riskFlags,
  };

  const { request } = await createPathologyRequest(
    {
      tenantId: tid,
      patientId,
      templateUsed: template,
      requestDate: new Date().toISOString().slice(0, 10),
      doctorUserId: input.actorUserId?.trim() || null,
      clinicalNotes: clinicalNotes || "Consultation-guided pathology screening draft.",
      tests: [{ code: null, label: "Consultation screening — review and add tests as needed" }],
      consultationId: cid,
      formInstanceId: fid,
      requestMetadata,
    },
    supabase
  );

  return { id: request.id, reused: false, href: pathologyHref(tid, patientId, request.id) };
}

export async function createSurgeryPlanningDraftFromConsultationSummary(
  input: ConsultationHandoffBaseInput,
  client?: SupabaseClient
): Promise<ConsultationHandoffMutationResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const cid = input.consultationId.trim();
  const fid = input.formInstanceId.trim();

  const { summary, consultation } = await requireLockedHandoffContext(tid, cid, fid);

  const caseId = consultation.case_id?.trim() || null;
  if (!surgeryPlanningHandoffEligible(summary, caseId)) {
    throw new Error("Surgery planning handoff requires proceed_surgery outcome, a linked case, and plan details in the summary.");
  }

  const { data: planRow, error: pe } = await supabase
    .from("fi_case_surgery_plans")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .eq("case_id", caseId)
    .maybeSingle();
  if (pe) throw new Error(pe.message);

  const existingMeta = planRow ? asRecord((planRow as { metadata?: unknown }).metadata) : {};
  if (String(existingMeta.source_form_instance_id ?? "") === fid) {
    const pid = String((planRow as { id: string }).id);
    return { id: pid, reused: true, href: caseHref(tid, caseId!) };
  }

  const plannedZones = summary.recommendedZones.map((z) => ({ key: z, label: z }));
  const strategy = buildSurgeryHandoffStrategyNotes(summary);

  await upsertSurgeryPlanForCase(
    {
      tenantId: tid,
      caseId: caseId!,
      patch: {
        planning_status: "draft",
        planned_zones: plannedZones,
        estimated_grafts_min: summary.estimatedGraftsMin ?? undefined,
        estimated_grafts_max: summary.estimatedGraftsMax ?? undefined,
        planning_notes: strategy,
        surgical_plan_summary: summary.recommendedProcedure.trim().slice(0, 4000) || null,
      },
    },
    supabase
  );

  const nextMeta = {
    ...existingMeta,
    source_form_instance_id: fid,
    source_consultation_id: cid,
    handoff_source: "consultation_completion",
    outcomeType: summary.outcomeType,
  };

  const { data: after, error: ue } = await supabase
    .from("fi_case_surgery_plans")
    .select("id")
    .eq("tenant_id", tid)
    .eq("case_id", caseId)
    .single();
  if (ue) throw new Error(ue.message);
  const planId = String((after as { id: string }).id);

  const { error: me } = await supabase.from("fi_case_surgery_plans").update({ metadata: nextMeta }).eq("id", planId).eq("tenant_id", tid);
  if (me) throw new Error(me.message);

  return { id: planId, reused: false, href: caseHref(tid, caseId!) };
}

export async function loadConsultationHandoffState(
  tenantId: string,
  consultationId: string,
  formInstanceId: string,
  client?: SupabaseClient
): Promise<{
  followUpTaskId: string | null;
  quoteId: string | null;
  pathologyRequestId: string | null;
  surgeryPlanId: string | null;
}> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  const fid = formInstanceId.trim();
  if (!tid || !cid || !fid) {
    return { followUpTaskId: null, quoteId: null, pathologyRequestId: null, surgeryPlanId: null };
  }

  const consultation = await loadConsultationForTenant(tid, cid);
  if (!consultation) {
    return { followUpTaskId: null, quoteId: null, pathologyRequestId: null, surgeryPlanId: null };
  }
  const leadId = consultation.lead_id?.trim();
  const patientId = consultation.patient_id?.trim();
  const caseId = consultation.case_id?.trim();

  let followUpTaskId: string | null = null;
  if (leadId) {
    const { data } = await supabase
      .from("fi_crm_tasks")
      .select("id")
      .eq("tenant_id", tid)
      .eq("lead_id", leadId)
      .eq("consultation_id", cid)
      .contains("metadata", handoffIdempotencyMetadata(fid, "consultation_completion"))
      .in("status", ["open", "in_progress", "blocked"])
      .maybeSingle();
    if (data?.id) followUpTaskId = String((data as { id: string }).id);
  }

  const { data: q } = await supabase
    .from("fi_crm_quotes")
    .select("id")
    .eq("tenant_id", tid)
    .eq("consultation_id", cid)
    .eq("status", "draft")
    .contains("metadata", handoffIdempotencyMetadata(fid, "consultation_quote_draft"))
    .maybeSingle();

  let pathologyRequestId: string | null = null;
  if (patientId) {
    const { data: pr } = await supabase
      .from("fi_pathology_requests")
      .select("id")
      .eq("tenant_id", tid)
      .eq("patient_id", patientId)
      .eq("consultation_id", cid)
      .eq("form_instance_id", fid)
      .eq("status", "saved")
      .maybeSingle();
    if (pr?.id) pathologyRequestId = String((pr as { id: string }).id);
  }

  let surgeryPlanId: string | null = null;
  if (caseId) {
    const { data: sp } = await supabase
      .from("fi_case_surgery_plans")
      .select("id, metadata")
      .eq("tenant_id", tid)
      .eq("case_id", caseId)
      .maybeSingle();
    const m = sp ? asRecord((sp as { metadata?: unknown }).metadata) : {};
    if (String(m.source_form_instance_id ?? "") === fid) {
      surgeryPlanId = sp ? String((sp as { id: string }).id) : null;
    }
  }

  return {
    followUpTaskId,
    quoteId: q?.id ? String((q as { id: string }).id) : null,
    pathologyRequestId,
    surgeryPlanId,
  };
}
