"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import {
  HLI_PHOTO_PROTOCOL_CLINICAL_CONTEXTS,
  type HliPhotoProtocolClinicalContext,
} from "@/src/lib/hair-intelligence/photoProtocols/types";
import {
  attachPatientImageToSessionSlot,
  completePhotoProtocolSessionIfEligible,
  createFiOsPhotoProtocolSession,
  markSessionSlotStatus,
} from "@/src/lib/hair-intelligence/photoProtocols/protocolSession.server";
import { resolveDefaultTemplateSlugForClinicalContext } from "@/src/lib/hair-intelligence/photoProtocols/protocolTemplates";
import { classifyPatientImageAction } from "@/src/lib/actions/fi-image-ai-actions";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePhotoProtocol(tenantId: string, patientId: string) {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
  revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
  revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
}

const CTX = HLI_PHOTO_PROTOCOL_CLINICAL_CONTEXTS as unknown as [string, ...string[]];

const createSessionBodySchema = z
  .object({
    adminKey: z.string().optional(),
    clinical_context: z.enum(CTX),
    case_id: z.string().uuid().nullable().optional(),
    template_slug: z.string().min(1).max(128).optional(),
  })
  .strict();

export async function createPhotoProtocolSessionAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  try {
    const parsed = createSessionBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const slug =
      parsed.template_slug?.trim() ||
      resolveDefaultTemplateSlugForClinicalContext(
        parsed.clinical_context as HliPhotoProtocolClinicalContext
      );
    const fiUserId = await tryResolveFiUserIdForTenant(tid, undefined);
    const { session } = await createFiOsPhotoProtocolSession({
      tenantId: tid,
      patientId: pid,
      caseId: parsed.case_id ?? null,
      templateSlug: slug,
      createdByUserId: fiUserId,
      clinicalContext: parsed.clinical_context,
    });
    revalidatePhotoProtocol(tid, pid);
    return { ok: true, sessionId: session.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const slotAttachBodySchema = z
  .object({
    adminKey: z.string().optional(),
    session_slot_row_id: z.string().uuid(),
    patient_image_id: z.string().uuid(),
  })
  .strict();

export async function attachImageToProtocolSlotAction(
  tenantId: string,
  patientId: string,
  sessionId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = slotAttachBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const supabase = supabaseAdmin();
    const { data: sess } = await supabase
      .from("hli_photo_protocol_sessions")
      .select("id, patient_id")
      .eq("tenant_id", tid)
      .eq("id", sessionId.trim())
      .maybeSingle();
    if (!sess || String((sess as { patient_id: string }).patient_id) !== pid) {
      throw new Error("Session not found for this patient.");
    }
    await attachPatientImageToSessionSlot({
      tenantId: tid,
      sessionId: sessionId.trim(),
      sessionSlotRowId: parsed.session_slot_row_id,
      patientImageId: parsed.patient_image_id,
    });
    revalidatePhotoProtocol(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const noteBodySchema = z
  .object({
    adminKey: z.string().optional(),
    session_slot_row_id: z.string().uuid(),
    note: z.string().min(1).max(2000),
  })
  .strict();

export async function markProtocolSlotNeedsRetakeAction(
  tenantId: string,
  patientId: string,
  sessionId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = noteBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const fiUserId = await tryResolveFiUserIdForTenant(tid, undefined);
    await markSessionSlotStatus({
      sessionSlotRowId: parsed.session_slot_row_id,
      sessionId: sessionId.trim(),
      tenantId: tid,
      status: "needs_retake",
      staffNote: parsed.note,
      reviewedByUserId: fiUserId,
    });
    revalidatePhotoProtocol(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const acceptBodySchema = z
  .object({
    adminKey: z.string().optional(),
    session_slot_row_id: z.string().uuid(),
    patient_image_id: z.string().uuid().optional(),
  })
  .strict();

export async function acceptProtocolSlotAction(
  tenantId: string,
  patientId: string,
  sessionId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = acceptBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const fiUserId = await tryResolveFiUserIdForTenant(tid, undefined);
    await markSessionSlotStatus({
      sessionSlotRowId: parsed.session_slot_row_id,
      sessionId: sessionId.trim(),
      tenantId: tid,
      status: "accepted",
      patientImageId: parsed.patient_image_id ?? null,
      reviewedByUserId: fiUserId,
    });
    revalidatePhotoProtocol(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function completePhotoProtocolSessionAction(
  tenantId: string,
  patientId: string,
  sessionId: string,
  body?: { adminKey?: string | null } | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminKey = body && typeof body === "object" ? body.adminKey : undefined;
    await assertCrmTenantWriteAllowed({
      tenantId,
      adminKey: adminKey ?? undefined,
      request: undefined,
    });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const supabase = supabaseAdmin();
    const { data: sess } = await supabase
      .from("hli_photo_protocol_sessions")
      .select("id, patient_id")
      .eq("tenant_id", tid)
      .eq("id", sessionId.trim())
      .maybeSingle();
    if (!sess || String((sess as { patient_id: string }).patient_id) !== pid) {
      throw new Error("Session not found for this patient.");
    }
    const res = await completePhotoProtocolSessionIfEligible({
      tenantId: tid,
      sessionId: sessionId.trim(),
    });
    if (!res.ok) throw new Error(res.reason);
    revalidatePhotoProtocol(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Runs existing Stage 8A classify action for each unclassified image (sequential). */
export async function analyseUnclassifiedProtocolImagesAction(
  tenantId: string,
  patientId: string,
  body?: { adminKey?: string | null; image_ids?: string[] } | null
): Promise<{ ok: true; processed: number } | { ok: false; error: string }> {
  try {
    const adminKey = body && typeof body === "object" ? body.adminKey : undefined;
    await assertCrmTenantWriteAllowed({
      tenantId,
      adminKey: adminKey ?? undefined,
      request: undefined,
    });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const ids =
      body && typeof body === "object" && Array.isArray(body.image_ids) ? body.image_ids : [];
    let n = 0;
    for (const raw of ids) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      const r = await classifyPatientImageAction(tid, pid, raw.trim(), { adminKey });
      if (!r.ok) throw new Error(r.error);
      n += 1;
    }
    revalidatePhotoProtocol(tid, pid);
    return { ok: true, processed: n };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
