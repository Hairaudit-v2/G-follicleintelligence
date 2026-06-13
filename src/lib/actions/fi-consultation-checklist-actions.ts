"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { generateFiOsPatientConsultationChecklistAndPersist } from "@/src/lib/hair-intelligence/consultationChecklist/adapters/fiOsConsultationChecklist.server";
import { consultationChecklistReviewBodySchema } from "@/src/lib/hair-intelligence/consultationChecklist/checklistReviewValidation";
import {
  clampConsultationChecklistConfidence,
  normalizeHieConsultationChecklistStatus,
  normalizeHieConsultationConsentComplexity,
  normalizeHieConsultationPriorityLevel,
} from "@/src/lib/hair-intelligence/consultationChecklist/enumValidation";
import { updateHairIntelligenceConsultationChecklistReview } from "@/src/lib/hair-intelligence/consultationChecklist/persistChecklist.server";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePatientTwin(tenantId: string, patientId: string) {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
  revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
}

function revalidateConsultationWorkspace(tenantId: string, consultationId: string) {
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
}

export async function generatePatientConsultationChecklistAction(
  tenantId: string,
  patientId: string,
  body?: { adminKey?: string | null; consultationId?: string | null; caseId?: string | null } | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminKey = body && typeof body === "object" ? body.adminKey : undefined;
    const consultationId = body && typeof body === "object" ? body.consultationId?.trim() : undefined;
    const caseId = body && typeof body === "object" ? body.caseId?.trim() : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: adminKey ?? undefined, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();

    const supabase = supabaseAdmin();
    const { data: row, error } = await supabase.from("fi_patients").select("id").eq("tenant_id", tid).eq("id", pid).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Patient not found for this tenant.");

    await generateFiOsPatientConsultationChecklistAndPersist({
      tenantId: tid,
      patientId: pid,
      caseId: caseId ?? null,
      sourceRecordId: consultationId ?? null,
      client: supabase,
    });

    revalidatePatientTwin(tid, pid);
    if (consultationId) revalidateConsultationWorkspace(tid, consultationId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateConsultationChecklistReviewAction(
  tenantId: string,
  patientId: string,
  checklistId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = consultationChecklistReviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const cid = checklistId.trim();
    const supabase = supabaseAdmin();

    const { data: row, error } = await supabase
      .from("hair_intelligence_consultation_checklists")
      .select("*")
      .eq("id", cid)
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Consultation checklist not found for this patient.");

    const x = row as Record<string, unknown>;
    const fiUserId = await tryResolveFiUserIdForTenant(tid, undefined);
    const now = new Date().toISOString();

    const existingItems = Array.isArray(x.checklist_items)
      ? (x.checklist_items as unknown[]).filter((t): t is string => typeof t === "string")
      : [];
    const existingFlags = Array.isArray(x.risk_flags)
      ? (x.risk_flags as unknown[]).filter((t): t is string => typeof t === "string")
      : [];

    const merged = {
      priority_level:
        parsed.priority_level !== undefined ? normalizeHieConsultationPriorityLevel(parsed.priority_level) : normalizeHieConsultationPriorityLevel(x.priority_level),
      confidence_score:
        parsed.confidence_score !== undefined
          ? clampConsultationChecklistConfidence(parsed.confidence_score)
          : clampConsultationChecklistConfidence(Number(x.confidence_score ?? 0)),
      medication_discussion_required:
        parsed.medication_discussion_required !== undefined
          ? parsed.medication_discussion_required
          : Boolean(x.medication_discussion_required),
      stabilisation_discussion_required:
        parsed.stabilisation_discussion_required !== undefined
          ? parsed.stabilisation_discussion_required
          : Boolean(x.stabilisation_discussion_required),
      donor_preservation_discussion_required:
        parsed.donor_preservation_discussion_required !== undefined
          ? parsed.donor_preservation_discussion_required
          : Boolean(x.donor_preservation_discussion_required),
      expectation_management_required:
        parsed.expectation_management_required !== undefined
          ? parsed.expectation_management_required
          : Boolean(x.expectation_management_required),
      consent_complexity_level:
        parsed.consent_complexity_level !== undefined
          ? normalizeHieConsultationConsentComplexity(parsed.consent_complexity_level)
          : normalizeHieConsultationConsentComplexity(x.consent_complexity_level),
      documentation_required:
        parsed.documentation_required !== undefined ? parsed.documentation_required : Boolean(x.documentation_required),
      follow_up_required: parsed.follow_up_required !== undefined ? parsed.follow_up_required : Boolean(x.follow_up_required),
      delay_recommended: parsed.delay_recommended !== undefined ? parsed.delay_recommended : Boolean(x.delay_recommended),
      consultation_summary:
        parsed.consultation_summary !== undefined ? parsed.consultation_summary : (x.consultation_summary as string | null),
      checklist_items: parsed.checklist_items !== undefined ? parsed.checklist_items : existingItems,
      risk_flags: parsed.risk_flags !== undefined ? parsed.risk_flags : existingFlags,
      ai_notes: parsed.ai_notes !== undefined ? parsed.ai_notes : (x.ai_notes as string | null),
      checklist_status:
        parsed.checklist_status !== undefined ? normalizeHieConsultationChecklistStatus(parsed.checklist_status) : normalizeHieConsultationChecklistStatus(x.checklist_status),
      review_status: parsed.review_status,
      reviewed_by_user_id: fiUserId,
      reviewed_at: now,
    };

    await updateHairIntelligenceConsultationChecklistReview(
      {
        id: cid,
        tenantId: tid,
        patch: merged,
      },
      supabase
    );

    revalidatePatientTwin(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
