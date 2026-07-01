"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import {
  upsertImagingAnnotationSet,
  upsertImagingScalpMap,
} from "@/src/lib/imagingOs/imagingOsMutations.server";
import {
  finishProtocolSessionManually,
  skipOptionalProtocolSlot,
} from "@/src/lib/imagingOs/imagingOsGuidedCapture.server";
import { PROGRESS_META_KEY } from "@/src/lib/imagingOs/imagingOsProtocol";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publishImagingEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import { loadOrCreateSurgeryDayVieSession } from "@/src/lib/surgeryOs/surgeryOsVieCapture.server";
import {
  bulkAssignImagingReviewItemsStaffNote,
  bulkAssignImagingStaffNote,
  bulkFlagImagingImagesRetakeRequired,
  bulkFlagImagingReviewItemsRetakeRequired,
  bulkMarkImagingImagesReviewed,
  bulkMarkImagingReviewItemsReviewed,
  flagImagingImageRetakeRequired,
  markImagingImageReviewed,
  reassignImagingImageViewType,
} from "@/src/lib/imaging-os/imagingStaffReviewMutations.server";
import {
  assignImagingReviewToStaff,
  bulkAssignImagingReviewItems,
  bulkUnassignImagingReviewItems,
  unassignImagingReview,
} from "@/src/lib/imaging-os/imagingReviewAssignmentMutations.server";

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
    analysisKind: z.enum([
      "density_estimate",
      "norwood_grade",
      "donor_assessment",
      "recipient_assessment",
      "clinical_image_analysis",
      "outcome_score",
    ]),
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
    bookingId: z.string().uuid().nullable().optional(),
    procedureDayId: z.string().uuid().nullable().optional(),
    surgeryId: z.string().uuid().nullable().optional(),
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
    const progressMeta: Record<string, unknown> = { status: "active" as const };
    if (parsed.bookingId || parsed.procedureDayId || parsed.surgeryId) {
      progressMeta.surgery_context = {
        booking_id: parsed.bookingId ?? null,
        procedure_day_id: parsed.procedureDayId ?? null,
        surgery_id: parsed.surgeryId ?? null,
        capture_surface: parsed.surgeryId ? "surgery_os" : null,
      };
    }
    const { data: ins, error } = await supabase
      .from("fi_imaging_protocol_sessions")
      .insert({
        tenant_id: tid,
        patient_id: pid,
        case_id: parsed.caseId ?? null,
        consultation_id: parsed.consultationId ?? null,
        template_slug: parsed.templateSlug.trim(),
        progress: { [PROGRESS_META_KEY]: progressMeta },
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
    revalidatePath(`/fi-admin/${tid}/surgery-os`);
    return { ok: true, sessionId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const surgeryOsVieSessionBodySchema = z
  .object({
    adminKey: z.string().optional(),
    caseId: z.string().uuid().nullable().optional(),
    bookingId: z.string().uuid().nullable().optional(),
    procedureDayId: z.string().uuid().nullable().optional(),
    surgeryId: z.string().uuid().nullable().optional(),
  })
  .strict();

/** Load active Surgery Day VIE session or create one for SurgeryOS embedded capture. */
export async function loadOrCreateSurgeryDayVieSessionAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<
  | { ok: true; sessionId: string; progress: Record<string, unknown>; created: boolean }
  | { ok: false; error: string }
> {
  try {
    const parsed = surgeryOsVieSessionBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const result = await loadOrCreateSurgeryDayVieSession({
      tenantId,
      patientId,
      caseId: parsed.caseId ?? null,
      bookingId: parsed.bookingId ?? null,
      procedureDayId: parsed.procedureDayId ?? null,
      surgeryId: parsed.surgeryId ?? null,
    });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
    revalidatePath(`/fi-admin/${tid}/surgery-os`);
    return { ok: true, ...result };
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

const imagingReviewActionSchema = z
  .object({
    adminKey: z.string().optional(),
    patientImageId: z.string().uuid(),
    staffNote: z.string().max(2000).optional(),
  })
  .strict();

export async function markImagingReviewReviewedAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = imagingReviewActionSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    await markImagingImageReviewed({
      tenantId,
      patientId,
      patientImageId: parsed.patientImageId,
      reviewedByUserId: actingUserId,
      staffNote: parsed.staffNote,
    });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function flagImagingReviewRetakeAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = imagingReviewActionSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    await flagImagingImageRetakeRequired({
      tenantId,
      patientId,
      patientImageId: parsed.patientImageId,
      reviewedByUserId: actingUserId,
      staffNote: parsed.staffNote,
    });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const reassignViewTypeSchema = imagingReviewActionSchema.extend({
  assignedViewType: z.string().min(1).max(64),
});

export async function reassignImagingReviewViewTypeAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = reassignViewTypeSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    await reassignImagingImageViewType({
      tenantId,
      patientId,
      patientImageId: parsed.patientImageId,
      assignedViewType: parsed.assignedViewType,
      reviewedByUserId: actingUserId,
      staffNote: parsed.staffNote,
    });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
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

const bulkReviewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    patientImageIds: z.array(z.string().uuid()).min(1).max(50),
    staffNote: z.string().max(2000).optional(),
  })
  .strict();

export async function bulkMarkImagingReviewReviewedAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<
  | { ok: true; succeeded: number; failed: Array<{ imageId: string; error: string }> }
  | { ok: false; error: string }
> {
  try {
    const parsed = bulkReviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await bulkMarkImagingImagesReviewed({
      tenantId,
      patientId,
      patientImageIds: parsed.patientImageIds,
      reviewedByUserId: actingUserId,
      staffNote: parsed.staffNote,
    });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
    return { ok: true, succeeded: result.succeeded.length, failed: result.failed };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function bulkFlagImagingReviewRetakeAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<
  | { ok: true; succeeded: number; failed: Array<{ imageId: string; error: string }> }
  | { ok: false; error: string }
> {
  try {
    const parsed = bulkReviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await bulkFlagImagingImagesRetakeRequired({
      tenantId,
      patientId,
      patientImageIds: parsed.patientImageIds,
      reviewedByUserId: actingUserId,
      staffNote: parsed.staffNote,
    });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
    return { ok: true, succeeded: result.succeeded.length, failed: result.failed };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const bulkStaffNoteSchema = bulkReviewBodySchema.extend({
  staffNote: z.string().min(1).max(2000),
});

export async function bulkAssignImagingStaffNoteAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<
  | { ok: true; succeeded: number; failed: Array<{ imageId: string; error: string }> }
  | { ok: false; error: string }
> {
  try {
    const parsed = bulkStaffNoteSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await bulkAssignImagingStaffNote({
      tenantId,
      patientId,
      patientImageIds: parsed.patientImageIds,
      reviewedByUserId: actingUserId,
      staffNote: parsed.staffNote,
    });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    return { ok: true, succeeded: result.succeeded.length, failed: result.failed };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const bulkQueueReviewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    items: z
      .array(
        z
          .object({
            patientId: z.string().uuid(),
            patientImageId: z.string().uuid(),
          })
          .strict()
      )
      .min(1)
      .max(50),
    staffNote: z.string().max(2000).optional(),
  })
  .strict();

export async function bulkMarkImagingQueueReviewedAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; succeeded: number; failed: Array<{ imageId: string; error: string }> }
  | { ok: false; error: string }
> {
  try {
    const parsed = bulkQueueReviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await bulkMarkImagingReviewItemsReviewed({
      tenantId,
      items: parsed.items,
      reviewedByUserId: actingUserId,
      staffNote: parsed.staffNote,
    });
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    for (const pid of new Set(parsed.items.map((i) => i.patientId))) {
      revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
      revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
    }
    return { ok: true, succeeded: result.succeeded.length, failed: result.failed };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function bulkFlagImagingQueueRetakeAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; succeeded: number; failed: Array<{ imageId: string; error: string }> }
  | { ok: false; error: string }
> {
  try {
    const parsed = bulkQueueReviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await bulkFlagImagingReviewItemsRetakeRequired({
      tenantId,
      items: parsed.items,
      reviewedByUserId: actingUserId,
      staffNote: parsed.staffNote,
    });
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    for (const pid of new Set(parsed.items.map((i) => i.patientId))) {
      revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
    }
    return { ok: true, succeeded: result.succeeded.length, failed: result.failed };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const bulkQueueStaffNoteSchema = bulkQueueReviewBodySchema.extend({
  staffNote: z.string().min(1).max(2000),
});

export async function bulkAssignImagingQueueStaffNoteAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; succeeded: number; failed: Array<{ imageId: string; error: string }> }
  | { ok: false; error: string }
> {
  try {
    const parsed = bulkQueueStaffNoteSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await bulkAssignImagingReviewItemsStaffNote({
      tenantId,
      items: parsed.items,
      reviewedByUserId: actingUserId,
      staffNote: parsed.staffNote,
    });
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    return { ok: true, succeeded: result.succeeded.length, failed: result.failed };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const assignReviewSchema = z
  .object({
    adminKey: z.string().optional(),
    patientImageId: z.string().uuid(),
    assignedToUserId: z.string().uuid(),
  })
  .strict();

export async function assignImagingReviewAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = assignReviewSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    await assignImagingReviewToStaff({
      tenantId,
      patientId,
      patientImageId: parsed.patientImageId,
      assignedToUserId: parsed.assignedToUserId,
      assignedByUserId: actingUserId,
    });
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const unassignReviewSchema = z
  .object({
    adminKey: z.string().optional(),
    patientImageId: z.string().uuid(),
  })
  .strict();

const bulkAssignReviewerSchema = z
  .object({
    adminKey: z.string().optional(),
    assignedToUserId: z.string().uuid(),
    items: z
      .array(
        z.object({
          patientId: z.string().uuid(),
          patientImageId: z.string().uuid(),
        })
      )
      .min(1)
      .max(100),
  })
  .strict();

export async function bulkAssignImagingQueueReviewerAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; succeeded: number; failed: Array<{ imageId: string; error: string }> }
  | { ok: false; error: string }
> {
  try {
    const parsed = bulkAssignReviewerSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await bulkAssignImagingReviewItems({
      tenantId,
      items: parsed.items,
      assignedToUserId: parsed.assignedToUserId,
      assignedByUserId: actingUserId,
    });
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    return { ok: true, succeeded: result.succeeded.length, failed: result.failed };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const bulkUnassignReviewerSchema = z
  .object({
    adminKey: z.string().optional(),
    items: z
      .array(
        z.object({
          patientId: z.string().uuid(),
          patientImageId: z.string().uuid(),
        })
      )
      .min(1)
      .max(100),
  })
  .strict();

export async function bulkUnassignImagingQueueReviewerAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; succeeded: number; failed: Array<{ imageId: string; error: string }> }
  | { ok: false; error: string }
> {
  try {
    const parsed = bulkUnassignReviewerSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    const result = await bulkUnassignImagingReviewItems({
      tenantId,
      items: parsed.items,
      assignedByUserId: actingUserId,
    });
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    return { ok: true, succeeded: result.succeeded.length, failed: result.failed };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function unassignImagingReviewAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = unassignReviewSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    await unassignImagingReview({
      tenantId,
      patientId,
      patientImageId: parsed.patientImageId,
      assignedByUserId: actingUserId,
    });
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/imaging/review`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function recordPatientPhotoQuickActionCompletedAction(
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = patientPhotoQuickActionCompletedSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId: parsed.tenantId, request: undefined });
    const { publishPatientPhotoQuickActionCompletedEvent } =
      await import("@/src/lib/patientImages/patientPhotoQuickActionAnalytics.server");
    await publishPatientPhotoQuickActionCompletedEvent(parsed);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const visualSummaryLoadSchema = z
  .object({
    adminKey: z.string().optional(),
    reportType: z.enum(["surgery_post_op_summary", "hairaudit_visual_summary"]),
    caseId: z.string().uuid().nullable().optional(),
    surgeryId: z.string().uuid().nullable().optional(),
    useInitials: z.boolean().optional(),
  })
  .strict();

export async function loadPatientVisualSummaryReportAction(
  tenantId: string,
  patientId: string,
  body: unknown
): Promise<
  | { ok: true; report: import("@/src/lib/imaging-os/patientVisualSummaryReportTypes").PatientVisualSummaryReport }
  | { ok: false; error: string }
> {
  try {
    const parsed = visualSummaryLoadSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const { loadPatientVisualSummaryReport } =
      await import("@/src/lib/imaging-os/patientVisualSummaryReportLoad.server");
    const report = await loadPatientVisualSummaryReport({
      tenantId,
      patientId,
      reportType: parsed.reportType,
      caseId: parsed.caseId ?? null,
      surgeryId: parsed.surgeryId ?? null,
      useInitials: parsed.useInitials,
    });
    return { ok: true, report };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const visualSummaryCaseMutationSchema = z
  .object({
    adminKey: z.string().optional(),
    caseId: z.string().uuid(),
    reportType: z.enum(["surgery_post_op_summary", "hairaudit_visual_summary"]),
    surgeryId: z.string().uuid().nullable().optional(),
  })
  .strict();

export async function approvePatientVisualSummaryReportAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = visualSummaryCaseMutationSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const actingUserId = await tryResolveFiUserIdForTenant(tenantId.trim(), undefined);
    if (!actingUserId) return { ok: false, error: "Could not resolve staff user for approval." };
    const { approvePatientVisualSummaryReport } =
      await import("@/src/lib/imaging-os/patientVisualSummaryReportMutations.server");
    await approvePatientVisualSummaryReport({
      tenantId,
      caseId: parsed.caseId,
      reportType: parsed.reportType,
      approvedByUserId: actingUserId,
      surgeryId: parsed.surgeryId ?? null,
    });
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/cases/${parsed.caseId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function regeneratePatientVisualSummaryReportAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = visualSummaryCaseMutationSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const { regeneratePatientVisualSummaryDraft } =
      await import("@/src/lib/imaging-os/patientVisualSummaryReportMutations.server");
    await regeneratePatientVisualSummaryDraft({
      tenantId,
      caseId: parsed.caseId,
      reportType: parsed.reportType,
      surgeryId: parsed.surgeryId ?? null,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const zoneDraftSchema = z
  .object({
    zone_id: z.enum(["zone_1", "zone_2", "zone_3", "zone_4"]),
    graft_count: z.string().optional(),
    density_range: z.string().optional(),
    grafts_per_cm2: z.string().optional(),
    qualitative_density: z.string().optional(),
    singles: z.string().optional(),
    doubles: z.string().optional(),
    triples: z.string().optional(),
    multi_hair: z.string().optional(),
    five_hair: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

const visualSummaryZoneSaveSchema = z
  .object({
    adminKey: z.string().optional(),
    caseId: z.string().uuid(),
    surgeryId: z.string().uuid().nullable().optional(),
    surgeryGraftTotal: z.number().int().nonnegative().nullable().optional(),
    zones: z.array(zoneDraftSchema),
    followUpPlan: z.string().nullable().optional(),
  })
  .strict();

export async function savePatientVisualSummaryZoneRecordAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; warnings: string[] } | { ok: false; error: string }> {
  try {
    const parsed = visualSummaryZoneSaveSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const { draftsToZoneInputs, validateAndBuildStaffRecord } =
      await import("@/src/lib/imaging-os/patientVisualSummaryRecordCore");
    const { savePatientVisualSummaryStaffRecord } =
      await import("@/src/lib/imaging-os/patientVisualSummaryReportMutations.server");

    let surgeryGraftTotal = parsed.surgeryGraftTotal ?? null;
    if (surgeryGraftTotal == null && parsed.surgeryId?.trim()) {
      const { loadGraftSessionsForSurgeries } =
        await import("@/src/lib/surgeryOs/surgeryGraftMutations.server");
      const sessions = await loadGraftSessionsForSurgeries(tenantId.trim(), [parsed.surgeryId.trim()]);
      const session = sessions.get(parsed.surgeryId.trim());
      if (session) {
        surgeryGraftTotal =
          session.implanted_grafts > 0
            ? session.implanted_grafts
            : session.extracted_grafts > 0
              ? session.extracted_grafts
              : null;
      }
    }

    const zoneDrafts = parsed.zones.map((z) => ({
      zone_id: z.zone_id,
      graft_count: z.graft_count ?? "",
      density_range: z.density_range ?? "",
      grafts_per_cm2: z.grafts_per_cm2 ?? "",
      qualitative_density: z.qualitative_density ?? "",
      singles: z.singles ?? "",
      doubles: z.doubles ?? "",
      triples: z.triples ?? "",
      multi_hair: z.multi_hair ?? "",
      five_hair: z.five_hair ?? "",
      notes: z.notes ?? "",
    }));

    const validation = validateAndBuildStaffRecord({
      zones: draftsToZoneInputs(zoneDrafts),
      zoneDrafts,
      followUpPlan: parsed.followUpPlan ?? null,
      surgeryGraftTotal,
    });
    if (!validation.ok) {
      return { ok: false, error: validation.errors.join(" ") };
    }

    await savePatientVisualSummaryStaffRecord({
      tenantId,
      caseId: parsed.caseId,
      record: validation.record,
    });

    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/cases/${parsed.caseId}`);
    return { ok: true, warnings: validation.warnings };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const visualSummaryStaffRecordLoadSchema = z
  .object({
    adminKey: z.string().optional(),
    caseId: z.string().uuid(),
  })
  .strict();

export async function loadPatientVisualSummaryStaffRecordAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; record: import("@/src/lib/imaging-os/patientVisualSummaryReportTypes").PatientVisualSummaryStaffRecord | null }
  | { ok: false; error: string }
> {
  try {
    const parsed = visualSummaryStaffRecordLoadSchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
    const { readPatientVisualSummaryStaffRecord } =
      await import("@/src/lib/imaging-os/patientVisualSummaryReportCore");
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_cases")
      .select("metadata, tenant_id")
      .eq("id", parsed.caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || String(data.tenant_id) !== tenantId.trim()) {
      return { ok: false, error: "Case not found." };
    }
    const meta =
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {};
    return { ok: true, record: readPatientVisualSummaryStaffRecord(meta) };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
