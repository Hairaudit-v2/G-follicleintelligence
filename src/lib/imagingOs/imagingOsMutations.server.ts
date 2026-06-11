import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { IMAGING_ANNOTATION_SCHEMA_VERSION } from "./imagingOsConstants";
import { loadPatientImageForPatient } from "@/src/lib/patientImages/patientImagesServer";

function assertPayloadObject(name: string, v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`${name} must be a JSON object.`);
  }
  return v as Record<string, unknown>;
}

export async function upsertImagingAnnotationSet(
  params: {
    tenantId: string;
    patientId: string;
    patientImageId: string;
    payload: unknown;
    actingUserId: string | null;
  },
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const iid = params.patientImageId.trim();
  const row = await loadPatientImageForPatient(tid, pid, iid, supabase);
  if (!row) throw new Error("Image not found for patient.");
  if (row.image_status !== "active") throw new Error("Cannot annotate archived image.");
  const payload = assertPayloadObject("payload", params.payload);
  const now = new Date().toISOString();

  const { data: existing, error: exErr } = await supabase
    .from("fi_imaging_annotation_sets")
    .select("id")
    .eq("tenant_id", tid)
    .eq("patient_image_id", iid)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);

  if (existing && (existing as { id: string }).id) {
    const { error } = await supabase
      .from("fi_imaging_annotation_sets")
      .update({
        payload,
        schema_version: IMAGING_ANNOTATION_SCHEMA_VERSION,
        updated_by_user_id: params.actingUserId,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("patient_image_id", iid);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("fi_imaging_annotation_sets").insert({
    tenant_id: tid,
    patient_image_id: iid,
    schema_version: IMAGING_ANNOTATION_SCHEMA_VERSION,
    payload,
    created_by_user_id: params.actingUserId,
    updated_by_user_id: params.actingUserId,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
}

export async function upsertImagingScalpMap(
  params: {
    tenantId: string;
    patientId: string;
    mapId: string | null;
    title: string;
    stateJson: unknown;
    consultationId?: string | null;
    caseId?: string | null;
    actingUserId: string | null;
  },
  client?: SupabaseClient
): Promise<{ id: string }> {
  const supabase = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const state = assertPayloadObject("stateJson", params.stateJson);
  const title = params.title.trim() || "Scalp map";
  const now = new Date().toISOString();

  if (params.mapId?.trim()) {
    const mid = params.mapId.trim();
    const { data, error } = await supabase
      .from("fi_imaging_scalp_maps")
      .update({
        title,
        state_json: state,
        consultation_id: params.consultationId ?? null,
        case_id: params.caseId ?? null,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .eq("id", mid)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String((data as { id: string }).id) };
  }

  const insert = {
    tenant_id: tid,
    patient_id: pid,
    consultation_id: params.consultationId ?? null,
    case_id: params.caseId ?? null,
    title,
    state_json: state,
    created_by_user_id: params.actingUserId,
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await supabase.from("fi_imaging_scalp_maps").insert(insert).select("id").single();
  if (error) throw new Error(error.message);
  return { id: String((data as { id: string }).id) };
}
