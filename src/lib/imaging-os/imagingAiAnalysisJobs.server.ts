import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const IMAGING_AI_ANALYSIS_KINDS = [
  "density_estimate",
  "norwood_grade",
  "donor_assessment",
  "recipient_assessment",
  "clinical_image_analysis",
  "outcome_score",
] as const;

export type ImagingAiAnalysisKind = (typeof IMAGING_AI_ANALYSIS_KINDS)[number];

export type ImagingAiJobStatus = "queued" | "running" | "completed" | "failed" | "superseded";

export type ImagingAiAnalysisJobRow = {
  id: string;
  tenant_id: string;
  patient_image_id: string;
  analysis_kind: ImagingAiAnalysisKind;
  status: ImagingAiJobStatus;
  request_payload: Record<string, unknown>;
  result_payload: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const MAX_JOB_ATTEMPTS = 3;

export function mapImagingAiJobRow(data: Record<string, unknown>): ImagingAiAnalysisJobRow {
  return {
    id: String(data.id),
    tenant_id: String(data.tenant_id),
    patient_image_id: String(data.patient_image_id),
    analysis_kind: String(data.analysis_kind) as ImagingAiAnalysisKind,
    status: String(data.status) as ImagingAiJobStatus,
    request_payload:
      data.request_payload && typeof data.request_payload === "object"
        ? (data.request_payload as Record<string, unknown>)
        : {},
    result_payload:
      data.result_payload && typeof data.result_payload === "object"
        ? (data.result_payload as Record<string, unknown>)
        : null,
    error_message: data.error_message != null ? String(data.error_message) : null,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
    completed_at: data.completed_at != null ? String(data.completed_at) : null,
  };
}

export async function enqueueImagingAiAnalysisJob(input: {
  tenantId: string;
  patientImageId: string;
  analysisKind: ImagingAiAnalysisKind;
  requestPayload?: Record<string, unknown>;
  client?: SupabaseClient;
}): Promise<string> {
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const imageId = input.patientImageId.trim();
  const now = new Date().toISOString();

  const { data: running, error: runErr } = await supabase
    .from("fi_imaging_ai_analysis_jobs")
    .select("id")
    .eq("tenant_id", tid)
    .eq("patient_image_id", imageId)
    .eq("analysis_kind", input.analysisKind)
    .eq("status", "running")
    .limit(1);
  if (runErr) throw new Error(runErr.message);
  if ((running ?? []).length > 0) {
    throw new Error("An analysis job is already running for this image.");
  }

  await supabase
    .from("fi_imaging_ai_analysis_jobs")
    .update({ status: "superseded", updated_at: now })
    .eq("tenant_id", tid)
    .eq("patient_image_id", imageId)
    .eq("analysis_kind", input.analysisKind)
    .eq("status", "queued");

  const { data: ins, error: insErr } = await supabase
    .from("fi_imaging_ai_analysis_jobs")
    .insert({
      tenant_id: tid,
      patient_image_id: imageId,
      analysis_kind: input.analysisKind,
      status: "queued",
      request_payload: input.requestPayload ?? {},
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  return String((ins as { id: string }).id);
}

export async function claimNextImagingAiAnalysisJob(input: {
  tenantId: string;
  client?: SupabaseClient;
}): Promise<ImagingAiAnalysisJobRow | null> {
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const now = new Date().toISOString();

  const { data: candidates, error: listErr } = await supabase
    .from("fi_imaging_ai_analysis_jobs")
    .select("*")
    .eq("tenant_id", tid)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(20);
  if (listErr) throw new Error(listErr.message);

  for (const candidate of candidates ?? []) {
    const row = candidate as Record<string, unknown>;
    const jobId = String(row.id);
    const imageId = String(row.patient_image_id);
    const kind = String(row.analysis_kind);

    const { data: concurrent } = await supabase
      .from("fi_imaging_ai_analysis_jobs")
      .select("id")
      .eq("tenant_id", tid)
      .eq("patient_image_id", imageId)
      .eq("analysis_kind", kind)
      .eq("status", "running")
      .limit(1);
    if ((concurrent ?? []).length > 0) continue;

    const { data: claimed, error: claimErr } = await supabase
      .from("fi_imaging_ai_analysis_jobs")
      .update({ status: "running", updated_at: now })
      .eq("tenant_id", tid)
      .eq("id", jobId)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();
    if (claimErr) throw new Error(claimErr.message);
    if (claimed) return mapImagingAiJobRow(claimed as Record<string, unknown>);
  }

  return null;
}

export async function completeImagingAiAnalysisJob(input: {
  tenantId: string;
  jobId: string;
  resultPayload: Record<string, unknown>;
  client?: SupabaseClient;
}): Promise<void> {
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_imaging_ai_analysis_jobs")
    .update({
      status: "completed",
      result_payload: input.resultPayload,
      error_message: null,
      completed_at: now,
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId.trim())
    .eq("id", input.jobId.trim())
    .eq("status", "running");
  if (error) throw new Error(error.message);
}

export async function failImagingAiAnalysisJob(input: {
  tenantId: string;
  jobId: string;
  errorMessage: string;
  retry?: boolean;
  client?: SupabaseClient;
}): Promise<void> {
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();
  const tid = input.tenantId.trim();
  const jobId = input.jobId.trim();

  const { data: job, error: loadErr } = await supabase
    .from("fi_imaging_ai_analysis_jobs")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", jobId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!job) return;

  const mapped = mapImagingAiJobRow(job as Record<string, unknown>);
  const attempts =
    typeof mapped.request_payload.attempt_count === "number"
      ? mapped.request_payload.attempt_count
      : 0;

  if (input.retry !== false && attempts + 1 < MAX_JOB_ATTEMPTS) {
    const { error: requeueErr } = await supabase
      .from("fi_imaging_ai_analysis_jobs")
      .update({
        status: "queued",
        error_message: input.errorMessage.slice(0, 2000),
        request_payload: { ...mapped.request_payload, attempt_count: attempts + 1 },
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", jobId)
      .eq("status", "running");
    if (requeueErr) throw new Error(requeueErr.message);
    return;
  }

  const { error } = await supabase
    .from("fi_imaging_ai_analysis_jobs")
    .update({
      status: "failed",
      error_message: input.errorMessage.slice(0, 2000),
      completed_at: now,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", jobId)
    .eq("status", "running");
  if (error) throw new Error(error.message);
}

export async function loadRegionLinkExists(
  supabase: SupabaseClient,
  tenantId: string,
  patientImageId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("fi_imaging_image_region_links")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("patient_image_id", patientImageId)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}