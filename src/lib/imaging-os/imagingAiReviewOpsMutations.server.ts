import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  enqueueImagingAiAnalysisJob,
  mapImagingAiJobRow,
  supersedeImagingAiAnalysisJob,
} from "./imagingAiAnalysisJobs.server";
import { loadGraftTrayAiEstimatesForImages } from "./graftTrayCountProvider.server";
import {
  canMarkImagingAiJobIgnored,
  canRequeueStaleImagingAiJob,
  canRetryFailedImagingAiJob,
} from "./imagingAiReviewOpsCore";

export type ImagingAiReviewOpsMutationResult = {
  action: "retry" | "requeue_stale" | "mark_ignored";
  supersededJobId: string;
  newJobId: string | null;
};

async function loadJobOrThrow(
  client: SupabaseClient,
  tenantId: string,
  jobId: string
) {
  const { data, error } = await client
    .from("fi_imaging_ai_analysis_jobs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("AI analysis job not found.");
  return mapImagingAiJobRow(data as Record<string, unknown>);
}

async function loadGraftTrayReviewStatus(
  client: SupabaseClient,
  tenantId: string,
  imageId: string
) {
  const estimates = await loadGraftTrayAiEstimatesForImages(tenantId, [imageId], client);
  return estimates.get(imageId)?.review_status ?? null;
}

export async function retryFailedImagingAiReviewJob(input: {
  tenantId: string;
  jobId: string;
  operatorUserId?: string | null;
  client?: SupabaseClient;
}): Promise<ImagingAiReviewOpsMutationResult> {
  const client = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const job = await loadJobOrThrow(client, tid, input.jobId);

  const graftTrayReviewStatus =
    job.analysis_kind === "graft_tray_count_estimate"
      ? await loadGraftTrayReviewStatus(client, tid, job.patient_image_id)
      : null;

  const gate = canRetryFailedImagingAiJob({
    jobStatus: job.status,
    analysisKind: job.analysis_kind,
    graftTrayReviewStatus,
  });
  if (!gate.allowed) throw new Error(gate.reason ?? "Retry not permitted.");

  await supersedeImagingAiAnalysisJob({
    tenantId: tid,
    jobId: job.id,
    reason: "operator_retry_failed_job",
    client,
  });

  const newJobId = await enqueueImagingAiAnalysisJob({
    tenantId: tid,
    patientImageId: job.patient_image_id,
    analysisKind: job.analysis_kind,
    requestPayload: {
      ...job.request_payload,
      attempt_count: 0,
      replay_source_job_id: job.id,
      replay_action: "retry",
      replayed_by_fi_user_id: input.operatorUserId ?? null,
      replayed_at: new Date().toISOString(),
    },
    client,
  });

  return { action: "retry", supersededJobId: job.id, newJobId };
}

export async function requeueStaleImagingAiReviewJob(input: {
  tenantId: string;
  jobId: string;
  operatorUserId?: string | null;
  client?: SupabaseClient;
}): Promise<ImagingAiReviewOpsMutationResult> {
  const client = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const job = await loadJobOrThrow(client, tid, input.jobId);

  const graftTrayReviewStatus =
    job.analysis_kind === "graft_tray_count_estimate"
      ? await loadGraftTrayReviewStatus(client, tid, job.patient_image_id)
      : null;

  const gate = canRequeueStaleImagingAiJob({
    jobStatus: job.status,
    updatedAt: job.updated_at,
    analysisKind: job.analysis_kind,
    graftTrayReviewStatus,
  });
  if (!gate.allowed) throw new Error(gate.reason ?? "Requeue not permitted.");

  await supersedeImagingAiAnalysisJob({
    tenantId: tid,
    jobId: job.id,
    reason: "operator_requeue_stale_running",
    client,
  });

  const newJobId = await enqueueImagingAiAnalysisJob({
    tenantId: tid,
    patientImageId: job.patient_image_id,
    analysisKind: job.analysis_kind,
    requestPayload: {
      ...job.request_payload,
      attempt_count: 0,
      replay_source_job_id: job.id,
      replay_action: "requeue_stale",
      replayed_by_fi_user_id: input.operatorUserId ?? null,
      replayed_at: new Date().toISOString(),
    },
    client,
  });

  return { action: "requeue_stale", supersededJobId: job.id, newJobId };
}

export async function markImagingAiReviewJobIgnored(input: {
  tenantId: string;
  jobId: string;
  reason: string;
  operatorUserId?: string | null;
  client?: SupabaseClient;
}): Promise<ImagingAiReviewOpsMutationResult> {
  const client = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const job = await loadJobOrThrow(client, tid, input.jobId);
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) throw new Error("A reason is required to mark a job as ignored.");

  const graftTrayReviewStatus =
    job.analysis_kind === "graft_tray_count_estimate"
      ? await loadGraftTrayReviewStatus(client, tid, job.patient_image_id)
      : null;

  const gate = canMarkImagingAiJobIgnored({
    jobStatus: job.status,
    analysisKind: job.analysis_kind,
    graftTrayReviewStatus,
  });
  if (!gate.allowed) throw new Error(gate.reason ?? "Ignore not permitted.");

  await supersedeImagingAiAnalysisJob({
    tenantId: tid,
    jobId: job.id,
    reason: `operator_ignored: ${trimmedReason.slice(0, 400)}`,
    client,
  });

  return { action: "mark_ignored", supersededJobId: job.id, newJobId: null };
}