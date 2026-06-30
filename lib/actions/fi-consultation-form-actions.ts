"use server";

import { revalidatePath } from "next/cache";

import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import type { ConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/consultationCompletionTypes";
import {
  autosaveConsultationFormInstance,
  completeConsultationFormInstance,
  submitConsultationFormInstance,
  upsertClinicalNoteForFormField,
} from "@/src/lib/consultationForms/consultationFormMutations.server";
import {
  createConsultationFollowUpTaskFromSummary,
  createConsultationPathologyRecommendationFromSummary,
  createConsultationQuoteDraftFromSummary,
  createSurgeryPlanningDraftFromConsultationSummary,
} from "@/src/lib/consultationForms/handoff/consultationHandoffMutations.server";
import type { ConsultationHandoffMutationResult } from "@/src/lib/consultationForms/handoff/consultationHandoffTypes";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function readRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function autosaveConsultationFormInstanceAction(
  tenantId: string,
  consultationId: string,
  instanceId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminKey =
      body && typeof body === "object" && body !== null && "adminKey" in body
        ? String((body as { adminKey?: string }).adminKey ?? "")
        : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });

    const values = readRecord(
      body && typeof body === "object" && body !== null && "values" in body
        ? (body as { values: unknown }).values
        : {}
    );
    const computedRaw =
      body && typeof body === "object" && body !== null && "computed" in body
        ? (body as { computed: unknown }).computed
        : undefined;
    const computed = computedRaw === undefined ? undefined : readRecord(computedRaw);

    await autosaveConsultationFormInstance({
      tenantId: tenantId.trim(),
      instanceId: instanceId.trim(),
      values,
      computed,
    });

    const tid = tenantId.trim();
    const cid = consultationId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}/forms`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function submitConsultationFormInstanceAction(
  tenantId: string,
  consultationId: string,
  instanceId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminKey =
      body && typeof body === "object" && body !== null && "adminKey" in body
        ? String((body as { adminKey?: string }).adminKey ?? "")
        : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });

    const values = readRecord(
      body && typeof body === "object" && body !== null && "values" in body
        ? (body as { values: unknown }).values
        : {}
    );
    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);

    await submitConsultationFormInstance({
      tenantId: tenantId.trim(),
      instanceId: instanceId.trim(),
      values,
      submittedByUserId: fiUserId,
    });

    const tid = tenantId.trim();
    const cid = consultationId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}/forms`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function upsertConsultationFormClinicalNoteAction(
  tenantId: string,
  consultationId: string,
  body: unknown
): Promise<{ ok: true; clinicalNoteId: string } | { ok: false; error: string }> {
  try {
    const adminKey =
      body && typeof body === "object" && body !== null && "adminKey" in body
        ? String((body as { adminKey?: string }).adminKey ?? "")
        : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });

    const b = readRecord(body);
    const formInstanceId = String(b.formInstanceId ?? "").trim();
    const formFieldId = String(b.formFieldId ?? "").trim();
    const transcriptRaw = typeof b.transcriptRaw === "string" ? b.transcriptRaw : "";
    const clinicalNoteId =
      typeof b.clinicalNoteId === "string" && b.clinicalNoteId.trim()
        ? b.clinicalNoteId.trim()
        : null;
    const sectionsRaw = b.sections;
    const sections =
      sectionsRaw && typeof sectionsRaw === "object" && !Array.isArray(sectionsRaw)
        ? (sectionsRaw as Record<string, unknown>)
        : undefined;

    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);

    const { clinicalNoteId: id } = await upsertClinicalNoteForFormField({
      tenantId: tenantId.trim(),
      consultationId: consultationId.trim(),
      formInstanceId,
      formFieldId,
      transcriptRaw,
      sections,
      existingClinicalNoteId: clinicalNoteId,
      createdByFiUserId: fiUserId,
    });

    const tid = tenantId.trim();
    const cid = consultationId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}/forms`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    return { ok: true, clinicalNoteId: id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function completeConsultationFormInstanceAction(
  tenantId: string,
  consultationId: string,
  body: unknown
): Promise<{ ok: true; summary: ConsultationCompletionSummary } | { ok: false; error: string }> {
  try {
    const adminKey =
      body && typeof body === "object" && body !== null && "adminKey" in body
        ? String((body as { adminKey?: string }).adminKey ?? "")
        : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });

    const b = readRecord(body);
    const formInstanceId = String(b.formInstanceId ?? "").trim();
    if (!formInstanceId) throw new Error("formInstanceId is required.");

    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);

    const { summary } = await completeConsultationFormInstance({
      tenantId: tenantId.trim(),
      consultationId: consultationId.trim(),
      formInstanceId,
      completedByUserId: fiUserId,
    });

    const tid = tenantId.trim();
    const cid = consultationId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}/forms`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

async function handoffFormInstanceId(body: unknown): Promise<string> {
  const b = readRecord(body);
  const formInstanceId = String(b.formInstanceId ?? "").trim();
  if (!formInstanceId) throw new Error("formInstanceId is required.");
  return formInstanceId;
}

export async function createConsultationFollowUpTaskFromSummaryAction(
  tenantId: string,
  consultationId: string,
  body: unknown
): Promise<{ ok: true; result: ConsultationHandoffMutationResult } | { ok: false; error: string }> {
  try {
    const adminKey =
      body && typeof body === "object" && body !== null && "adminKey" in body
        ? String((body as { adminKey?: string }).adminKey ?? "")
        : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });
    const fid = await handoffFormInstanceId(body);
    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await createConsultationFollowUpTaskFromSummary({
      tenantId: tenantId.trim(),
      consultationId: consultationId.trim(),
      formInstanceId: fid,
      actorUserId: fiUserId,
    });
    const tid = tenantId.trim();
    const cid = consultationId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}/forms`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createConsultationQuoteDraftFromSummaryAction(
  tenantId: string,
  consultationId: string,
  body: unknown
): Promise<{ ok: true; result: ConsultationHandoffMutationResult } | { ok: false; error: string }> {
  try {
    const adminKey =
      body && typeof body === "object" && body !== null && "adminKey" in body
        ? String((body as { adminKey?: string }).adminKey ?? "")
        : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });
    const fid = await handoffFormInstanceId(body);
    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await createConsultationQuoteDraftFromSummary({
      tenantId: tenantId.trim(),
      consultationId: consultationId.trim(),
      formInstanceId: fid,
      actorUserId: fiUserId,
    });
    const tid = tenantId.trim();
    const cid = consultationId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}/forms`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createConsultationPathologyRecommendationFromSummaryAction(
  tenantId: string,
  consultationId: string,
  body: unknown
): Promise<{ ok: true; result: ConsultationHandoffMutationResult } | { ok: false; error: string }> {
  try {
    const adminKey =
      body && typeof body === "object" && body !== null && "adminKey" in body
        ? String((body as { adminKey?: string }).adminKey ?? "")
        : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });
    const fid = await handoffFormInstanceId(body);
    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await createConsultationPathologyRecommendationFromSummary({
      tenantId: tenantId.trim(),
      consultationId: consultationId.trim(),
      formInstanceId: fid,
      actorUserId: fiUserId,
    });
    const tid = tenantId.trim();
    const cid = consultationId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}/forms`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createSurgeryPlanningDraftFromConsultationSummaryAction(
  tenantId: string,
  consultationId: string,
  body: unknown
): Promise<{ ok: true; result: ConsultationHandoffMutationResult } | { ok: false; error: string }> {
  try {
    const adminKey =
      body && typeof body === "object" && body !== null && "adminKey" in body
        ? String((body as { adminKey?: string }).adminKey ?? "")
        : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey, request: undefined });
    const fid = await handoffFormInstanceId(body);
    const fiUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await createSurgeryPlanningDraftFromConsultationSummary({
      tenantId: tenantId.trim(),
      consultationId: consultationId.trim(),
      formInstanceId: fid,
      actorUserId: fiUserId,
    });
    const tid = tenantId.trim();
    const cid = consultationId.trim();
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}/forms`);
    revalidatePath(`/fi-admin/${tid}/consultations/${cid}`);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
