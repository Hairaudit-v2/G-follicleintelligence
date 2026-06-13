import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE } from "./protocolSessionRules";
import { scoreImageForProtocolSlot } from "./protocolSlotMatching";
import type {
  HliPhotoProtocolSession,
  HliPhotoProtocolSessionSlot,
  HliPhotoProtocolSlot,
  HliPhotoProtocolTemplate,
} from "./types";

function mapTemplate(r: Record<string, unknown>): HliPhotoProtocolTemplate {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: r.description != null ? String(r.description) : null,
    source_system_scope: String(r.source_system_scope) as HliPhotoProtocolTemplate["source_system_scope"],
    clinical_context: String(r.clinical_context) as HliPhotoProtocolTemplate["clinical_context"],
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function mapSlot(r: Record<string, unknown>): HliPhotoProtocolSlot {
  const acc = r.acceptable_image_categories;
  const acceptable =
    Array.isArray(acc) && acc.length > 0 ? (acc.map((x) => String(x)) as HliPhotoProtocolSlot["acceptable_image_categories"]) : null;
  return {
    id: String(r.id),
    protocol_template_id: String(r.protocol_template_id),
    slot_slug: String(r.slot_slug),
    label: String(r.label),
    required_image_category: r.required_image_category != null ? (String(r.required_image_category) as HliPhotoProtocolSlot["required_image_category"]) : null,
    acceptable_image_categories: acceptable,
    required_surgery_stage: r.required_surgery_stage != null ? (String(r.required_surgery_stage) as HliPhotoProtocolSlot["required_surgery_stage"]) : null,
    required_hair_state: r.required_hair_state != null ? (String(r.required_hair_state) as HliPhotoProtocolSlot["required_hair_state"]) : null,
    required_shave_state: r.required_shave_state != null ? (String(r.required_shave_state) as HliPhotoProtocolSlot["required_shave_state"]) : null,
    sort_order: Number(r.sort_order ?? 0),
    is_required: Boolean(r.is_required),
    capture_guidance: r.capture_guidance != null ? String(r.capture_guidance) : null,
    quality_guidance: r.quality_guidance != null ? String(r.quality_guidance) : null,
  };
}

function mapSession(r: Record<string, unknown>): HliPhotoProtocolSession {
  const meta = r.metadata;
  return {
    id: String(r.id),
    source_system: String(r.source_system) as HliPhotoProtocolSession["source_system"],
    source_record_id: String(r.source_record_id),
    tenant_id: r.tenant_id != null ? String(r.tenant_id) : null,
    patient_id: r.patient_id != null ? String(r.patient_id) : null,
    case_id: r.case_id != null ? String(r.case_id) : null,
    protocol_template_id: String(r.protocol_template_id),
    status: String(r.status) as HliPhotoProtocolSession["status"],
    started_at: r.started_at != null ? String(r.started_at) : null,
    completed_at: r.completed_at != null ? String(r.completed_at) : null,
    created_by_user_id: r.created_by_user_id != null ? String(r.created_by_user_id) : null,
    metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function mapSessionSlot(r: Record<string, unknown>): HliPhotoProtocolSessionSlot {
  return {
    id: String(r.id),
    session_id: String(r.session_id),
    slot_id: String(r.slot_id),
    patient_image_id: r.patient_image_id != null ? String(r.patient_image_id) : null,
    status: String(r.status) as HliPhotoProtocolSessionSlot["status"],
    ai_match_confidence:
      r.ai_match_confidence != null && r.ai_match_confidence !== "" ? Number(r.ai_match_confidence) : null,
    staff_note: r.staff_note != null ? String(r.staff_note) : null,
    reviewed_by_user_id: r.reviewed_by_user_id != null ? String(r.reviewed_by_user_id) : null,
    reviewed_at: r.reviewed_at != null ? String(r.reviewed_at) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function loadTemplateWithSlotsBySlug(
  slug: string,
  client?: SupabaseClient
): Promise<{ template: HliPhotoProtocolTemplate; slots: HliPhotoProtocolSlot[] } | null> {
  const supabase = client ?? supabaseAdmin();
  const { data: t, error } = await supabase
    .from("hli_photo_protocol_templates")
    .select("*")
    .eq("slug", slug.trim())
    .eq("is_active", true)
    .maybeSingle();
  if (error || !t) return null;
  const template = mapTemplate(t as Record<string, unknown>);
  const { data: slots, error: sErr } = await supabase
    .from("hli_photo_protocol_slots")
    .select("*")
    .eq("protocol_template_id", template.id)
    .order("sort_order", { ascending: true });
  if (sErr) throw new Error(sErr.message);
  return { template, slots: (slots ?? []).map((x) => mapSlot(x as Record<string, unknown>)) };
}

export async function loadTemplateWithSlotsByTemplateId(
  templateId: string,
  client?: SupabaseClient
): Promise<{ template: HliPhotoProtocolTemplate; slots: HliPhotoProtocolSlot[] } | null> {
  const supabase = client ?? supabaseAdmin();
  const { data: t, error } = await supabase.from("hli_photo_protocol_templates").select("*").eq("id", templateId.trim()).maybeSingle();
  if (error || !t) return null;
  const template = mapTemplate(t as Record<string, unknown>);
  const { data: slots, error: sErr } = await supabase
    .from("hli_photo_protocol_slots")
    .select("*")
    .eq("protocol_template_id", template.id)
    .order("sort_order", { ascending: true });
  if (sErr) throw new Error(sErr.message);
  return { template, slots: (slots ?? []).map((x) => mapSlot(x as Record<string, unknown>)) };
}

export async function loadLatestActivePhotoSessionForPatient(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<{
  session: HliPhotoProtocolSession;
  sessionSlots: HliPhotoProtocolSessionSlot[];
  slotsById: Map<string, HliPhotoProtocolSlot>;
} | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const { data: sess, error } = await supabase
    .from("hli_photo_protocol_sessions")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .eq("source_system", "fi_os")
    .in("status", ["draft", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !sess) return null;
  const session = mapSession(sess as Record<string, unknown>);
  const { data: ssRows, error: ssErr } = await supabase
    .from("hli_photo_protocol_session_slots")
    .select("*")
    .eq("session_id", session.id);
  if (ssErr) throw new Error(ssErr.message);
  const sessionSlots = (ssRows ?? []).map((x) => mapSessionSlot(x as Record<string, unknown>));
  const { data: slotDefs, error: dErr } = await supabase
    .from("hli_photo_protocol_slots")
    .select("*")
    .eq("protocol_template_id", session.protocol_template_id);
  if (dErr) throw new Error(dErr.message);
  const slotsById = new Map<string, HliPhotoProtocolSlot>();
  for (const s of slotDefs ?? []) {
    const sl = mapSlot(s as Record<string, unknown>);
    slotsById.set(sl.id, sl);
  }
  return { session, sessionSlots, slotsById };
}

export async function createFiOsPhotoProtocolSession(params: {
  tenantId: string;
  patientId: string;
  caseId: string | null;
  templateSlug: string;
  createdByUserId: string | null;
  clinicalContext: string;
  client?: SupabaseClient;
}): Promise<{ session: HliPhotoProtocolSession; sessionSlots: HliPhotoProtocolSessionSlot[] }> {
  const supabase = params.client ?? supabaseAdmin();
  const loaded = await loadTemplateWithSlotsBySlug(params.templateSlug, supabase);
  if (!loaded) throw new Error(`Protocol template not found: ${params.templateSlug}`);
  const now = new Date().toISOString();
  const { data: ins, error } = await supabase
    .from("hli_photo_protocol_sessions")
    .insert({
      source_system: "fi_os",
      source_record_id: `fi_patient:${params.patientId.trim()}`,
      tenant_id: params.tenantId.trim(),
      patient_id: params.patientId.trim(),
      case_id: params.caseId?.trim() || null,
      protocol_template_id: loaded.template.id,
      status: "in_progress",
      started_at: now,
      created_by_user_id: params.createdByUserId,
      metadata: { clinical_context: params.clinicalContext },
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const session = mapSession(ins as Record<string, unknown>);

  const slotRows = loaded.slots.map((sl) => ({
    session_id: session.id,
    slot_id: sl.id,
    patient_image_id: null,
    status: sl.is_required ? "missing" : "missing",
    ai_match_confidence: null,
    staff_note: null,
    reviewed_by_user_id: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
  }));
  const { data: ssIns, error: ssErr } = await supabase.from("hli_photo_protocol_session_slots").insert(slotRows).select("*");
  if (ssErr) throw new Error(ssErr.message);
  return { session, sessionSlots: (ssIns ?? []).map((x) => mapSessionSlot(x as Record<string, unknown>)) };
}

export async function attachPatientImageToSessionSlot(params: {
  tenantId: string;
  sessionId: string;
  sessionSlotRowId: string;
  patientImageId: string;
  client?: SupabaseClient;
}): Promise<void> {
  const supabase = params.client ?? supabaseAdmin();
  const { data: row, error } = await supabase
    .from("hli_photo_protocol_session_slots")
    .select("id, session_id, slot_id")
    .eq("id", params.sessionSlotRowId.trim())
    .eq("session_id", params.sessionId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Session slot not found.");

  const { data: sess, error: sErr } = await supabase
    .from("hli_photo_protocol_sessions")
    .select("id, tenant_id, patient_id")
    .eq("id", params.sessionId.trim())
    .maybeSingle();
  if (sErr || !sess) throw new Error("Session not found.");
  if (String((sess as { tenant_id: string }).tenant_id) !== params.tenantId.trim()) throw new Error("Tenant mismatch.");

  const { data: img, error: iErr } = await supabase
    .from("fi_patient_images")
    .select(
      "id, patient_id, ai_image_category, ai_image_category_confidence, ai_hair_state, ai_shave_state, ai_surgery_stage, ai_image_review_status"
    )
    .eq("tenant_id", params.tenantId.trim())
    .eq("id", params.patientImageId.trim())
    .eq("image_status", "active")
    .maybeSingle();
  if (iErr || !img) throw new Error("Patient image not found.");
  if (String((img as { patient_id: string }).patient_id) !== String((sess as { patient_id: string }).patient_id)) {
    throw new Error("Image patient mismatch.");
  }

  const { data: slotDef } = await supabase.from("hli_photo_protocol_slots").select("*").eq("id", String((row as { slot_id: string }).slot_id)).maybeSingle();
  if (!slotDef) throw new Error("Slot definition missing.");
  const slot = mapSlot(slotDef as Record<string, unknown>);
  const ir = img as Record<string, unknown>;
  const complianceImg = {
    id: params.patientImageId.trim(),
    ai_image_category: ir?.ai_image_category != null ? String(ir.ai_image_category) : null,
    ai_image_category_confidence: ir?.ai_image_category_confidence != null ? Number(ir.ai_image_category_confidence) : null,
    ai_hair_state: ir?.ai_hair_state != null ? String(ir.ai_hair_state) : null,
    ai_shave_state: ir?.ai_shave_state != null ? String(ir.ai_shave_state) : null,
    ai_surgery_stage: ir?.ai_surgery_stage != null ? String(ir.ai_surgery_stage) : null,
    ai_image_review_status: ir?.ai_image_review_status != null ? String(ir.ai_image_review_status) : null,
  };
  const { score } = scoreImageForProtocolSlot(slot, complianceImg);
  const now = new Date().toISOString();
  const { error: uErr } = await supabase
    .from("hli_photo_protocol_session_slots")
    .update({
      patient_image_id: params.patientImageId.trim(),
      status: "captured",
      ai_match_confidence: score,
      updated_at: now,
    })
    .eq("id", params.sessionSlotRowId.trim())
    .eq("session_id", params.sessionId.trim());
  if (uErr) throw new Error(uErr.message);
}

export async function markSessionSlotStatus(params: {
  sessionSlotRowId: string;
  sessionId: string;
  tenantId: string;
  status: HliPhotoProtocolSessionSlot["status"];
  staffNote?: string | null;
  reviewedByUserId?: string | null;
  patientImageId?: string | null;
  client?: SupabaseClient;
}): Promise<void> {
  const supabase = params.client ?? supabaseAdmin();
  const now = new Date().toISOString();
  const { data: sess, error: se } = await supabase
    .from("hli_photo_protocol_sessions")
    .select("id, tenant_id")
    .eq("id", params.sessionId.trim())
    .eq("tenant_id", params.tenantId.trim())
    .maybeSingle();
  if (se || !sess) throw new Error("Session not found.");
  const { data: ss, error } = await supabase
    .from("hli_photo_protocol_session_slots")
    .select("id")
    .eq("id", params.sessionSlotRowId.trim())
    .eq("session_id", params.sessionId.trim())
    .maybeSingle();
  if (error || !ss) throw new Error("Session slot not found.");
  const patch: Record<string, unknown> = {
    status: params.status,
    staff_note: params.staffNote ?? null,
    updated_at: now,
  };
  if (params.patientImageId) patch.patient_image_id = params.patientImageId.trim();
  if (params.status === "accepted" || params.status === "needs_retake") {
    patch.reviewed_at = now;
    patch.reviewed_by_user_id = params.reviewedByUserId ?? null;
  }
  const { error: uErr } = await supabase
    .from("hli_photo_protocol_session_slots")
    .update(patch)
    .eq("id", params.sessionSlotRowId.trim())
    .eq("session_id", params.sessionId.trim());
  if (uErr) throw new Error(uErr.message);
}

export async function completePhotoProtocolSessionIfEligible(params: {
  tenantId: string;
  sessionId: string;
  client?: SupabaseClient;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = params.client ?? supabaseAdmin();
  const { data: sess, error } = await supabase
    .from("hli_photo_protocol_sessions")
    .select("*")
    .eq("tenant_id", params.tenantId.trim())
    .eq("id", params.sessionId.trim())
    .maybeSingle();
  if (error || !sess) return { ok: false, reason: "Session not found." };
  const { data: ssRows, error: ssErr } = await supabase
    .from("hli_photo_protocol_session_slots")
    .select("id, status, ai_match_confidence, slot_id")
    .eq("session_id", params.sessionId.trim());
  if (ssErr) return { ok: false, reason: ssErr.message };
  const slotIds = [...new Set((ssRows ?? []).map((r) => String((r as { slot_id: string }).slot_id)))];
  const { data: slotRows } = await supabase.from("hli_photo_protocol_slots").select("id, is_required").in("id", slotIds);
  const reqBySlot = new Map<string, boolean>();
  for (const t of slotRows ?? []) {
    const tr = t as { id: string; is_required: boolean };
    reqBySlot.set(String(tr.id), Boolean(tr.is_required));
  }
  for (const r of ssRows ?? []) {
    const x = r as { slot_id: string; status: string; ai_match_confidence: number | null };
    if (!reqBySlot.get(x.slot_id)) continue;
    const st = String(x.status ?? "");
    if (st === "accepted") continue;
    if (st === "missing" || st === "needs_retake" || st === "optional_skipped") return { ok: false, reason: "Required slots are not satisfied." };
    if (st === "captured") {
      const conf = x.ai_match_confidence != null ? Number(x.ai_match_confidence) : 0;
      if (conf < PROTOCOL_STRONG_CAPTURE_MIN_CONFIDENCE) return { ok: false, reason: "Captured slot confidence too low — accept or retake." };
    } else {
      return { ok: false, reason: "Required slots are not satisfied." };
    }
  }
  const now = new Date().toISOString();
  const { error: uErr } = await supabase
    .from("hli_photo_protocol_sessions")
    .update({ status: "complete", completed_at: now, updated_at: now })
    .eq("id", params.sessionId.trim())
    .eq("tenant_id", params.tenantId.trim());
  if (uErr) return { ok: false, reason: uErr.message };
  return { ok: true };
}
