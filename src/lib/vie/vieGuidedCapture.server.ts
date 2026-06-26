import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { archivePatientImage } from "@/src/lib/patientImages/patientImagesServer";
import {
  assertSlotBelongsToTemplate,
  getSlotImageIds,
  isSessionMarkedComplete,
  missingRequiredSlotSlugs,
  nextRecommendedSlotSlug,
  parseProgressMeta,
  protocolRequiredCompletionPercent,
  PROGRESS_META_KEY,
  type ProgressMeta,
  type ProtocolSlotDef,
} from "@/src/lib/imagingOs/imagingOsProtocol";
import {
  loadImagingProtocolSessionForPatient,
  loadProtocolTemplateBySlug,
} from "@/src/lib/imagingOs/imagingOsGuidedCapture.server";
import { loadVieCapturePolicyForTenant } from "./vieCapturePolicy.server";
import { canAcceptVieCapture } from "./vieQualityGate";
import type { VieCaptureReviewPayload, VieInstantIntelligenceResult } from "./vieProtocolTypes";

export type VieGuidedSessionApi = {
  completionPercent: number;
  sessionCompleted: boolean;
  missingRequired: string[];
  nextSlotSlug: string | null;
};

function buildGuidedSessionApi(
  slots: ProtocolSlotDef[],
  progress: Record<string, unknown>
): VieGuidedSessionApi {
  const pct = protocolRequiredCompletionPercent(slots, progress);
  const meta = parseProgressMeta(progress);
  return {
    completionPercent: pct,
    sessionCompleted: meta.status === "completed" || Boolean(meta.completed_at),
    missingRequired: missingRequiredSlotSlugs(slots, progress),
    nextSlotSlug: nextRecommendedSlotSlug(slots, progress),
  };
}

async function persistSessionProgress(
  tenantId: string,
  patientId: string,
  sessionId: string,
  progress: Record<string, unknown>,
  client: SupabaseClient
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from("fi_imaging_protocol_sessions")
    .update({ progress, updated_at: now })
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .eq("id", sessionId.trim());
  if (error) throw new Error(error.message);
}

async function markIntelligenceAccepted(params: {
  tenantId: string;
  intelligenceId: string;
  acceptedByUserId: string | null;
  qualityOverride: boolean;
  client: SupabaseClient;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await params.client
    .from("fi_vie_capture_intelligence")
    .update({
      acceptance_status: "accepted",
      accepted_at: now,
      accepted_by_user_id: params.acceptedByUserId,
      quality_override: params.qualityOverride,
      updated_at: now,
    })
    .eq("tenant_id", params.tenantId.trim())
    .eq("id", params.intelligenceId.trim());
  if (error) throw new Error(error.message);
}

async function markIntelligenceReplaced(params: {
  tenantId: string;
  intelligenceId: string | null;
  replacedByImageId: string | null;
  client: SupabaseClient;
}): Promise<void> {
  if (!params.intelligenceId?.trim()) return;
  const now = new Date().toISOString();
  const { error } = await params.client
    .from("fi_vie_capture_intelligence")
    .update({
      acceptance_status: "replaced",
      replaced_at: now,
      replaced_by_image_id: params.replacedByImageId,
      updated_at: now,
    })
    .eq("tenant_id", params.tenantId.trim())
    .eq("id", params.intelligenceId.trim());
  if (error) throw new Error(error.message);
}

/** Stage a VIE capture for staff review — slot is NOT marked complete until accept. */
export async function stageVieProtocolCapture(params: {
  tenantId: string;
  patientId: string;
  sessionId: string;
  slotSlug: string;
  newImageId: string;
  intelligence: VieInstantIntelligenceResult;
  intelligenceId: string | null;
  replacePrevious: boolean;
  client?: SupabaseClient;
}): Promise<VieGuidedSessionApi> {
  const supabase = params.client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const session = await loadImagingProtocolSessionForPatient(tid, pid, params.sessionId, supabase);
  if (!session) throw new Error("Protocol session not found for this patient.");
  if (isSessionMarkedComplete(session.progress)) {
    throw new Error("This protocol session is already complete.");
  }

  const tpl = await loadProtocolTemplateBySlug(tid, session.template_slug, supabase);
  if (!tpl) throw new Error("Protocol template not found.");
  assertSlotBelongsToTemplate(tpl.slots, params.slotSlug);

  const next = { ...session.progress };
  const meta = parseProgressMeta(next);
  const pending = { ...(meta.vie_pending ?? {}) };
  const existingPending = pending[params.slotSlug];

  if (existingPending && existingPending.patient_image_id !== params.newImageId) {
    try {
      await archivePatientImage({
        tenantId: tid,
        patientId: pid,
        imageId: existingPending.patient_image_id,
        archiveReason: "Superseded by VIE retake before accept",
        request: null,
      });
    } catch {
      // best-effort
    }
    await markIntelligenceReplaced({
      tenantId: tid,
      intelligenceId: existingPending.intelligence_id,
      replacedByImageId: params.newImageId,
      client: supabase,
    });
  }

  if (params.replacePrevious) {
    const acceptedIds = getSlotImageIds(next, params.slotSlug);
    for (const oldId of acceptedIds) {
      if (oldId === params.newImageId) continue;
      try {
        await archivePatientImage({
          tenantId: tid,
          patientId: pid,
          imageId: oldId,
          archiveReason: "Replaced during VIE guided capture retake",
          request: null,
        });
      } catch {
        // best-effort
      }
    }
    delete next[params.slotSlug];
    const slotQuality = { ...(meta.vie_slot_quality ?? {}) };
    delete slotQuality[params.slotSlug];
    meta.vie_slot_quality = Object.keys(slotQuality).length > 0 ? slotQuality : undefined;
  }

  pending[params.slotSlug] = {
    patient_image_id: params.newImageId.trim(),
    intelligence_id: params.intelligenceId,
    captured_at: new Date().toISOString(),
    quality_score: params.intelligence.quality_score,
    quality_band: params.intelligence.quality_band,
    clinically_usable: params.intelligence.clinical_usability.clinically_usable,
  };

  next[PROGRESS_META_KEY] = {
    ...meta,
    status: meta.status === "completed" ? "completed" : "active",
    vie_pending: pending,
  } satisfies ProgressMeta;

  await persistSessionProgress(tid, pid, session.id, next, supabase);
  return buildGuidedSessionApi(tpl.slots, next);
}

export async function acceptVieProtocolCapture(params: {
  tenantId: string;
  patientId: string;
  sessionId: string;
  slotSlug: string;
  qualityOverride?: boolean;
  acceptedByUserId?: string | null;
  client?: SupabaseClient;
}): Promise<{
  guided_session: VieGuidedSessionApi;
  review: VieCaptureReviewPayload["review"];
  accepted_image_id?: string;
}> {
  const supabase = params.client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const policy = await loadVieCapturePolicyForTenant(tid, supabase);

  const session = await loadImagingProtocolSessionForPatient(tid, pid, params.sessionId, supabase);
  if (!session) throw new Error("Protocol session not found for this patient.");
  if (isSessionMarkedComplete(session.progress)) {
    throw new Error("This protocol session is already complete.");
  }

  const tpl = await loadProtocolTemplateBySlug(tid, session.template_slug, supabase);
  if (!tpl) throw new Error("Protocol template not found.");

  const next = { ...session.progress };
  const meta = parseProgressMeta(next);
  const pending = meta.vie_pending?.[params.slotSlug];
  if (!pending) throw new Error("No pending capture to accept for this slot.");

  let clinical = {
    status: (pending.clinically_usable ? "usable" : "unusable") as "usable" | "warning" | "unusable",
    clinically_usable: pending.clinically_usable,
    warnings: [] as string[],
    retake_recommendation: pending.clinically_usable ? null : "Retake recommended.",
  };

  if (pending.intelligence_id) {
    const { data: intelRow } = await supabase
      .from("fi_vie_capture_intelligence")
      .select("clinical_usability, quality_score, clinically_usable, retake_recommendation, warnings")
      .eq("tenant_id", tid)
      .eq("id", pending.intelligence_id)
      .maybeSingle();
    if (intelRow) {
      const r = intelRow as Record<string, unknown>;
      if (r.clinical_usability && typeof r.clinical_usability === "object") {
        clinical = r.clinical_usability as typeof clinical;
      }
    }
  }

  const review = canAcceptVieCapture({
    clinical,
    quality_score: pending.quality_score,
    policy,
    quality_override: params.qualityOverride === true,
  });

  if (!review.allowed) {
    return { guided_session: buildGuidedSessionApi(tpl.slots, next), review };
  }

  const prevAccepted = getSlotImageIds(next, params.slotSlug);
  next[params.slotSlug] = [pending.patient_image_id];

  const pendingMap = { ...(meta.vie_pending ?? {}) };
  delete pendingMap[params.slotSlug];

  const slotQuality = { ...(meta.vie_slot_quality ?? {}) };
  slotQuality[params.slotSlug] = {
    patient_image_id: pending.patient_image_id,
    intelligence_id: pending.intelligence_id,
    quality_score: pending.quality_score,
    quality_band: pending.quality_band,
    clinically_usable: pending.clinically_usable,
    accepted_at: new Date().toISOString(),
    quality_override: params.qualityOverride === true ? true : undefined,
  };

  const pct = protocolRequiredCompletionPercent(tpl.slots, next);
  let mergedMeta: ProgressMeta = {
    ...meta,
    vie_pending: Object.keys(pendingMap).length > 0 ? pendingMap : undefined,
    vie_slot_quality: slotQuality,
    status: "active",
  };
  if (pct >= 100) {
    mergedMeta = { ...mergedMeta, status: "completed", completed_at: new Date().toISOString() };
  }
  next[PROGRESS_META_KEY] = mergedMeta;

  for (const oldId of prevAccepted) {
    if (oldId === pending.patient_image_id) continue;
    try {
      await archivePatientImage({
        tenantId: tid,
        patientId: pid,
        imageId: oldId,
        archiveReason: "Replaced on VIE capture accept",
        request: null,
      });
    } catch {
      // best-effort
    }
  }

  if (pending.intelligence_id) {
    await markIntelligenceAccepted({
      tenantId: tid,
      intelligenceId: pending.intelligence_id,
      acceptedByUserId: params.acceptedByUserId ?? null,
      qualityOverride: params.qualityOverride === true,
      client: supabase,
    });
  }

  await persistSessionProgress(tid, pid, session.id, next, supabase);
  return {
    guided_session: buildGuidedSessionApi(tpl.slots, next),
    review: { allowed: true, requires_override: review.requires_override, reason: null },
    accepted_image_id: pending.patient_image_id,
  };
}

export async function retakeVieProtocolCapture(params: {
  tenantId: string;
  patientId: string;
  sessionId: string;
  slotSlug: string;
  client?: SupabaseClient;
}): Promise<VieGuidedSessionApi> {
  const supabase = params.client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();

  const session = await loadImagingProtocolSessionForPatient(tid, pid, params.sessionId, supabase);
  if (!session) throw new Error("Protocol session not found for this patient.");

  const tpl = await loadProtocolTemplateBySlug(tid, session.template_slug, supabase);
  if (!tpl) throw new Error("Protocol template not found.");

  const next = { ...session.progress };
  const meta = parseProgressMeta(next);
  const pending = meta.vie_pending?.[params.slotSlug];
  if (!pending) throw new Error("No pending capture to retake for this slot.");

  try {
    await archivePatientImage({
      tenantId: tid,
      patientId: pid,
      imageId: pending.patient_image_id,
      archiveReason: "VIE capture retake — staff rejected pending image",
      request: null,
    });
  } catch {
    // best-effort
  }

  await markIntelligenceReplaced({
    tenantId: tid,
    intelligenceId: pending.intelligence_id,
    replacedByImageId: null,
    client: supabase,
  });

  const pendingMap = { ...(meta.vie_pending ?? {}) };
  delete pendingMap[params.slotSlug];
  next[PROGRESS_META_KEY] = {
    ...meta,
    vie_pending: Object.keys(pendingMap).length > 0 ? pendingMap : undefined,
  };

  await persistSessionProgress(tid, pid, session.id, next, supabase);
  return buildGuidedSessionApi(tpl.slots, next);
}

export function buildCaptureReviewPayload(
  intelligence: VieInstantIntelligenceResult,
  policy: Awaited<ReturnType<typeof loadVieCapturePolicyForTenant>>
): VieCaptureReviewPayload {
  const review = canAcceptVieCapture({
    clinical: intelligence.clinical_usability,
    quality_score: intelligence.quality_score,
    policy,
  });
  return {
    ...intelligence,
    review,
    policy: {
      allow_quality_override: policy.allow_quality_override,
      minimum_capture_quality_score: policy.minimum_capture_quality_score,
      block_clinically_unusable_images: policy.block_clinically_unusable_images,
    },
  };
}
