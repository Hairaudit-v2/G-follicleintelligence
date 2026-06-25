"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { assertCrmTenantWriteAllowed, CrmAccessError, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { upsertImagingAnnotationSet, upsertImagingScalpMap } from "@/src/lib/imagingOs/imagingOsMutations.server";
import {
  finishProtocolSessionManually,
  skipOptionalProtocolSlot,
} from "@/src/lib/imagingOs/imagingOsGuidedCapture.server";
import { PROGRESS_META_KEY } from "@/src/lib/imagingOs/imagingOsProtocol";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publishImagingEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const annotationBodySchema = z
  .object({
    adminKey: z.string().optional(),
    payload: z.unknown(),
  })
  .strict();

export async function saveImagingAnnotationSetAction(
  tenantId: string,
  patientId: string,
  patientImageId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = annotationBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    await upsertImagingAnnotationSet({
      tenantId,
      patientId,
      patientImageId,
      payload: parsed.payload,
      actingUserId,
    });
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}/imaging`);
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const scalpMapBodySchema = z
  .object({
    adminKey: z.string().optional(),
    mapId: z.string().uuid().nullable().optional(),
    title: z.string().optional(),
    stateJson: z.unknown(),
    consultationId: z.string().uuid().nullable().optional(),
    caseId: z.string().uuid().nullable().optional(),
  })
  .strict();

export async function saveImagingScalpMapAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true; mapId: string } | { ok: false; error: string }> {
  try {
    const parsed = scalpMapBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const res = await upsertImagingScalpMap({
      tenantId,
      patientId,
      mapId: parsed.mapId ?? null,
      title: parsed.title?.trim() ?? "Scalp map",
      stateJson: parsed.stateJson,
      consultationId: parsed.consultationId,
      caseId: parsed.caseId,
      actingUserId,
    });
    revalidatePath(`/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}/imaging`);
    return { ok: true, mapId: res.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const aiJobBodySchema = z
  .object({
    adminKey: z.string().optional(),
    patientImageId: z.string().uuid(),
    analysisKind: z.enum(["density_estimate", "norwood_grade", "donor_assessment", "outcome_score"]),
  })
  .strict();

/** Queues a HairIntel-style analysis job (worker processes rows separately). */
export async function enqueueImagingAiJobAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  try {
    const parsed = aiJobBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const supabase = supabaseAdmin();
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const { data: img, error: imgErr } = await supabase
      .from("fi_patient_images")
      .select("id")
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .eq("id", parsed.patientImageId)
      .eq("image_status", "active")
      .maybeSingle();
    if (imgErr) throw new Error(imgErr.message);
    if (!img) throw new Error("Image not found.");

    const now = new Date().toISOString();
    const { data: ins, error: insErr } = await supabase
      .from("fi_imaging_ai_analysis_jobs")
      .insert({
        tenant_id: tid,
        patient_image_id: parsed.patientImageId,
        analysis_kind: parsed.analysisKind,
        status: "queued",
        request_payload: {},
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    const jobId = String((ins as { id: string }).id);

    void publishImagingEvent({
      tenantId: tid,
      eventType: "ai_imaging_completed",
      entityId: parsed.patientImageId,
      entityType: "image",
      eventMetadata: {
        patient_id: pid,
        analysis_kind: parsed.analysisKind,
        job_id: jobId,
        mode: "queued",
      },
    });

    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    return { ok: true, jobId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const protocolSessionBodySchema = z
  .object({
    adminKey: z.string().optional(),
    templateSlug: z.string().min(1).max(128),
    caseId: z.string().uuid().nullable().optional(),
    consultationId: z.string().uuid().nullable().optional(),
  })
  .strict();

export async function createImagingProtocolSessionAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  try {
    const parsed = protocolSessionBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const supabase = supabaseAdmin();
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const now = new Date().toISOString();
    // `fi_imaging_protocol_sessions` has no top-level `status` column; session state lives in `progress` jsonb
    // (including per-step status under PROGRESS_META_KEY).
    const { data: ins, error } = await supabase
      .from("fi_imaging_protocol_sessions")
      .insert({
        tenant_id: tid,
        patient_id: pid,
        case_id: parsed.caseId ?? null,
        consultation_id: parsed.consultationId ?? null,
        template_slug: parsed.templateSlug.trim(),
        progress: { [PROGRESS_META_KEY]: { status: "active" as const } },
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const sessionId = String((ins as { id: string }).id);

    void publishImagingEvent({
      tenantId: tid,
      eventType: "imaging_session_created",
      entityId: sessionId,
      entityType: "session",
      eventMetadata: {
        patient_id: pid,
        protocol: parsed.templateSlug.trim(),
        case_id: parsed.caseId ?? null,
        consultation_id: parsed.consultationId ?? null,
      },
    });

    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
    return { ok: true, sessionId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const skipGuidedSlotBodySchema = z
  .object({
    adminKey: z.string().optional(),
    sessionId: z.string().uuid(),
    slotSlug: z.string().min(1).max(128),
    reason: z.string().min(1).max(500),
  })
  .strict();

export async function skipGuidedProtocolSlotAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      completionPercent: number;
      sessionCompleted: boolean;
      missingRequired: string[];
      nextSlotSlug: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    const parsed = skipGuidedSlotBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const guided = await skipOptionalProtocolSlot({
      tenantId: tid,
      patientId: pid,
      sessionId: parsed.sessionId,
      slotSlug: parsed.slotSlug.trim(),
      reason: parsed.reason.trim(),
    });
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
    return { ok: true, ...guided };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const finishGuidedSessionBodySchema = z
  .object({
    adminKey: z.string().optional(),
    sessionId: z.string().uuid(),
  })
  .strict();

export async function finishGuidedProtocolSessionAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = finishGuidedSessionBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    await finishProtocolSessionManually({
      tenantId: tid,
      patientId: pid,
      sessionId: parsed.sessionId,
    });
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const patientPhotoQuickActionCompletedSchema = z
  .object({
    tenantId: z.string().uuid(),
    patientId: z.string().uuid(),
    intent: z.enum(["camera", "library"]),
    source: z.enum(["patient_profile", "patient_slide_over"]),
  })
  .strict();

export async function recordPatientPhotoQuickActionCompletedAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = patientPhotoQuickActionCompletedSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId: parsed.tenantId, request: undefined });
    const { publishPatientPhotoQuickActionCompletedEvent } = await import(
      "@/src/lib/patientImages/patientPhotoQuickActionAnalytics.server"
    );
    await publishPatientPhotoQuickActionCompletedEvent(parsed);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
