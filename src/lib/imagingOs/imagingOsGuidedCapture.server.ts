import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { archivePatientImage } from "@/src/lib/patientImages/patientImagesServer";
import {
  assertSlotBelongsToTemplate,
  isSessionMarkedComplete,
  mergeProgressForSlotCapture,
  missingRequiredSlotSlugs,
  nextRecommendedSlotSlug,
  parseProgressMeta,
  parseProtocolSlots,
  PROGRESS_META_KEY,
  protocolRequiredCompletionPercent,
  type ProgressMeta,
  type ProtocolSlotDef,
} from "./imagingOsProtocol";

export type GuidedSessionRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  template_slug: string;
  progress: Record<string, unknown>;
};

export async function loadImagingProtocolSessionForPatient(
  tenantId: string,
  patientId: string,
  sessionId: string,
  client?: SupabaseClient
): Promise<GuidedSessionRow | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const sid = sessionId.trim();
  const { data, error } = await supabase
    .from("fi_imaging_protocol_sessions")
    .select("id, tenant_id, patient_id, template_slug, progress")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", sid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  const progress =
    r.progress && typeof r.progress === "object" && !Array.isArray(r.progress) ? (r.progress as Record<string, unknown>) : {};
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    patient_id: String(r.patient_id),
    template_slug: String(r.template_slug ?? ""),
    progress,
  };
}

export async function loadProtocolTemplateBySlug(
  tenantId: string,
  templateSlug: string,
  client?: SupabaseClient
): Promise<{ slug: string; slots: ProtocolSlotDef[] } | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const slug = templateSlug.trim();
  const { data, error } = await supabase
    .from("fi_imaging_protocol_templates")
    .select("slug, slots")
    .or(`tenant_id.eq.${tid},tenant_id.is.null`)
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return { slug: String(r.slug ?? slug), slots: parseProtocolSlots(r.slots) };
}

/**
 * After a patient image row is created, attach it to the protocol session slot and optionally archive prior slot images.
 */
export async function applyGuidedCaptureToSession(params: {
  tenantId: string;
  patientId: string;
  sessionId: string;
  newImageId: string;
  slotSlug: string;
  replacePrevious: boolean;
  templateSlugFromImageRow: string | null;
}): Promise<{
  completionPercent: number;
  sessionCompleted: boolean;
  missingRequired: string[];
  nextSlotSlug: string | null;
}> {
  const supabase = supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const session = await loadImagingProtocolSessionForPatient(tid, pid, params.sessionId, supabase);
  if (!session) throw new Error("Protocol session not found for this patient.");
  if (isSessionMarkedComplete(session.progress)) {
    throw new Error("This protocol session is already complete.");
  }

  if (params.templateSlugFromImageRow && params.templateSlugFromImageRow.trim() !== session.template_slug.trim()) {
    throw new Error("Image protocol template does not match active session.");
  }

  const tpl = await loadProtocolTemplateBySlug(tid, session.template_slug, supabase);
  if (!tpl) throw new Error("Protocol template not found.");
  assertSlotBelongsToTemplate(tpl.slots, params.slotSlug);

  const prevIds = mergeProgressForSlotCapture.extractPreviousSlotImageIds(session.progress, params.slotSlug);
  const nextProgress = mergeProgressForSlotCapture.apply(session.progress, params.slotSlug, params.newImageId);

  if (params.replacePrevious && prevIds.length > 0) {
    for (const oldId of prevIds) {
      if (oldId === params.newImageId) continue;
      try {
        await archivePatientImage({
          tenantId: tid,
          patientId: pid,
          imageId: oldId,
          archiveReason: "Replaced during guided ImagingOS capture",
          request: null,
        });
      } catch {
        // best-effort
      }
    }
  }

  const meta = parseProgressMeta(nextProgress);
  const pct = protocolRequiredCompletionPercent(tpl.slots, nextProgress);
  let mergedMeta: ProgressMeta = { ...meta, status: meta.status === "completed" ? "completed" : "active" };
  let sessionCompleted = false;
  if (pct >= 100) {
    mergedMeta = { ...mergedMeta, status: "completed", completed_at: new Date().toISOString() };
    sessionCompleted = true;
  }
  nextProgress[PROGRESS_META_KEY] = mergedMeta;

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("fi_imaging_protocol_sessions")
    .update({ progress: nextProgress, updated_at: now })
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", session.id);
  if (upErr) throw new Error(upErr.message);

  return {
    completionPercent: pct,
    sessionCompleted,
    missingRequired: missingRequiredSlotSlugs(tpl.slots, nextProgress),
    nextSlotSlug: nextRecommendedSlotSlug(tpl.slots, nextProgress),
  };
}

export async function skipOptionalProtocolSlot(params: {
  tenantId: string;
  patientId: string;
  sessionId: string;
  slotSlug: string;
  reason: string;
}): Promise<{
  completionPercent: number;
  sessionCompleted: boolean;
  missingRequired: string[];
  nextSlotSlug: string | null;
}> {
  const supabase = supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const session = await loadImagingProtocolSessionForPatient(tid, pid, params.sessionId, supabase);
  if (!session) throw new Error("Protocol session not found for this patient.");
  if (isSessionMarkedComplete(session.progress)) {
    throw new Error("This protocol session is already complete.");
  }

  const tpl = await loadProtocolTemplateBySlug(tid, session.template_slug, supabase);
  if (!tpl) throw new Error("Protocol template not found.");
  const slot = tpl.slots.find((s) => s.slug === params.slotSlug);
  if (!slot) throw new Error("Unknown protocol slot.");
  if (slot.required !== false) {
    throw new Error("Required slots cannot be skipped.");
  }

  const reason = params.reason.trim();
  if (!reason) throw new Error("Skip reason is required.");

  const next = { ...session.progress };
  const meta = parseProgressMeta(next);
  const skips = { ...(meta.skips ?? {}) };
  skips[params.slotSlug] = { reason, skipped_at: new Date().toISOString() };
  next[PROGRESS_META_KEY] = { ...meta, skips };

  const pct = protocolRequiredCompletionPercent(tpl.slots, next);
  let sessionCompleted = false;
  if (pct >= 100) {
    next[PROGRESS_META_KEY] = {
      ...parseProgressMeta(next),
      status: "completed",
      completed_at: new Date().toISOString(),
    };
    sessionCompleted = true;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_imaging_protocol_sessions")
    .update({ progress: next, updated_at: now })
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", session.id);
  if (error) throw new Error(error.message);
  return {
    completionPercent: pct,
    sessionCompleted,
    missingRequired: missingRequiredSlotSlugs(tpl.slots, next),
    nextSlotSlug: nextRecommendedSlotSlug(tpl.slots, next),
  };
}

export async function finishProtocolSessionManually(params: {
  tenantId: string;
  patientId: string;
  sessionId: string;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const session = await loadImagingProtocolSessionForPatient(tid, pid, params.sessionId, supabase);
  if (!session) throw new Error("Protocol session not found for this patient.");
  const next = { ...session.progress };
  const meta = parseProgressMeta(next);
  next[PROGRESS_META_KEY] = {
    ...meta,
    status: "completed",
    finished_at: new Date().toISOString(),
  };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_imaging_protocol_sessions")
    .update({ progress: next, updated_at: now })
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("id", session.id);
  if (error) throw new Error(error.message);
}
