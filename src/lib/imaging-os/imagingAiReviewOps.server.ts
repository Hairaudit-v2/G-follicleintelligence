import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ImagingAiAnalysisKind } from "./imagingAiAnalysisKinds";
import { mapImagingAiJobRow } from "./imagingAiAnalysisJobs.server";
import { loadGraftTrayAiEstimatesForImages } from "./graftTrayCountProvider.server";
import type { GraftTrayAiReviewStatus } from "./graftTrayCountTypes";
import {
  buildImagingAiReviewOpsJobView,
  deriveImagingAiJobStartedAt,
  IMAGING_AI_REVIEW_OPS_DEFAULT_KIND,
  type ImagingAiReviewOpsBucket,
  type ImagingAiReviewOpsJobSnapshot,
  type ImagingAiReviewOpsJobView,
  readImagingAiJobAttemptCount,
  readImagingAiJobSupersedeReason,
} from "./imagingAiReviewOpsCore";

export type ImagingAiReviewOpsHealthSummary = {
  analysisKind: ImagingAiAnalysisKind;
  totalJobs: number;
  bucketCounts: Record<ImagingAiReviewOpsBucket, number>;
  jobs: ImagingAiReviewOpsJobView[];
};

function readProviderFromJobResult(
  analysisKind: ImagingAiAnalysisKind,
  resultPayload: Record<string, unknown> | null
): string | null {
  if (analysisKind !== "graft_tray_count_estimate" || !resultPayload) return null;
  const summary = resultPayload.summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
  const provider = (summary as Record<string, unknown>).provider;
  return typeof provider === "string" ? provider : null;
}

function toJobSnapshot(
  row: ReturnType<typeof mapImagingAiJobRow>,
  graftTrayReviewStatus: GraftTrayAiReviewStatus | null,
  providerOverride: string | null
): ImagingAiReviewOpsJobSnapshot {
  return {
    jobId: row.id,
    analysisKind: row.analysis_kind,
    jobStatus: row.status,
    attemptCount: readImagingAiJobAttemptCount(row.request_payload),
    lastError: row.error_message,
    queuedAt: row.created_at,
    startedAt: deriveImagingAiJobStartedAt({ jobStatus: row.status, updatedAt: row.updated_at }),
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    provider: providerOverride,
    graftTrayReviewStatus,
    supersedeReason: readImagingAiJobSupersedeReason(row.request_payload),
  };
}

export async function loadImagingAiReviewOpsHealth(input: {
  tenantId: string;
  analysisKind?: ImagingAiAnalysisKind;
  limit?: number;
  client?: SupabaseClient;
}): Promise<ImagingAiReviewOpsHealthSummary> {
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const kind = input.analysisKind ?? IMAGING_AI_REVIEW_OPS_DEFAULT_KIND;
  const limit = Math.max(1, Math.min(input.limit ?? 100, 200));

  const { data: jobs, error } = await supabase
    .from("fi_imaging_ai_analysis_jobs")
    .select("*")
    .eq("tenant_id", tid)
    .eq("analysis_kind", kind)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const mappedJobs = (jobs ?? []).map((row) => mapImagingAiJobRow(row as Record<string, unknown>));
  const imageIds = [...new Set(mappedJobs.map((j) => j.patient_image_id))];

  const { data: images, error: imgErr } = imageIds.length
    ? await supabase
        .from("fi_patient_images")
        .select("id, patient_id")
        .eq("tenant_id", tid)
        .in("id", imageIds)
    : { data: [], error: null };
  if (imgErr) throw new Error(imgErr.message);

  const patientIdByImage = new Map<string, string | null>();
  for (const row of images ?? []) {
    const r = row as { id: string; patient_id: string | null };
    patientIdByImage.set(r.id, r.patient_id != null ? String(r.patient_id) : null);
  }

  const estimates =
    kind === "graft_tray_count_estimate"
      ? await loadGraftTrayAiEstimatesForImages(tid, imageIds, supabase)
      : new Map();

  const views: ImagingAiReviewOpsJobView[] = mappedJobs.map((job) => {
    const estimate = estimates.get(job.patient_image_id) ?? null;
    const provider =
      estimate?.provider ?? readProviderFromJobResult(kind, job.result_payload) ?? null;
    const snapshot = toJobSnapshot(job, estimate?.review_status ?? null, provider);
    return buildImagingAiReviewOpsJobView({
      tenantId: tid,
      patientImageId: job.patient_image_id,
      patientId: patientIdByImage.get(job.patient_image_id) ?? null,
      snapshot,
      estimate: estimate
        ? {
            confidence_band: estimate.confidence_band,
            image_quality: estimate.image_quality,
            review_status: estimate.review_status,
            provider: estimate.provider,
          }
        : null,
    });
  });

  const bucketCounts = Object.fromEntries(
    [
      "queued",
      "running",
      "stale_running",
      "completed_awaiting_review",
      "failed",
      "low_confidence",
      "provider_unavailable",
      "requires_staff_review",
      "superseded",
    ].map((bucket) => [bucket, 0])
  ) as Record<ImagingAiReviewOpsBucket, number>;

  for (const view of views) {
    for (const bucket of view.buckets) {
      bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;
    }
  }

  return {
    analysisKind: kind,
    totalJobs: views.length,
    bucketCounts,
    jobs: views,
  };
}
