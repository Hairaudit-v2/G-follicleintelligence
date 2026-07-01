import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  claimNextImagingAiAnalysisJob,
  completeImagingAiAnalysisJob,
  failImagingAiAnalysisJob,
  loadRegionLinkExists,
  type ImagingAiAnalysisJobRow,
} from "./imagingAiAnalysisJobs.server";
import {
  runClinicalImageAnalysis,
  persistClinicalImageAnalysisMetadata,
} from "./clinicalImageAnalysisProvider.server";
import { clinicalAnalysisResultToMetadataRecord } from "./clinicalImageAnalysisCore";
import { assessFiOsPatientDonorAndPersist } from "@/src/lib/hair-intelligence/donorIntelligence/adapters/fiOsDonorAssessment.server";
import { assessFiOsPatientRecipientAndPersist } from "@/src/lib/hair-intelligence/recipientCandidacy/adapters/fiOsRecipientAssessment.server";
import {
  mergeImagingJobSummariesMetadata,
  type ReadOnlyJobSummary,
} from "./imagingJobReadOnlySummaries";
import { buildLiveNorwoodSignalSummary, parseImagingNorwoodProviderFlag } from "./imagingNorwoodSignalCore";
import type { NorwoodSignalSummary } from "./imagingNorwoodSignalCore";
import {
  buildLiveDensitySignalSummary,
  buildLiveOutcomeScoreSignalSummary,
  parseImagingLiveProviderFlags,
  type OutcomeSignalSummary,
} from "./imagingOutcomeSignalsCore";
import { resolveLiveImagingSignalProvider } from "./liveImagingSignalProviders.server";

export type ProcessImagingAiJobResult = {
  jobId: string;
  status: "completed" | "failed" | "requeued";
  analysisKind: string;
};

async function loadPatientImageContext(
  supabase: SupabaseClient,
  tenantId: string,
  imageId: string
): Promise<{
  metadata: Record<string, unknown>;
  aiImageCategory: string | null;
  aiImageCategoryConfidence: number | null;
  patientId: string | null;
}> {
  const { data, error } = await supabase
    .from("fi_patient_images")
    .select("metadata, ai_image_category, ai_image_category_confidence, patient_id")
    .eq("tenant_id", tenantId)
    .eq("id", imageId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient image not found.");
  const row = data as Record<string, unknown>;
  return {
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
    aiImageCategory: row.ai_image_category != null ? String(row.ai_image_category) : null,
    aiImageCategoryConfidence:
      row.ai_image_category_confidence != null ? Number(row.ai_image_category_confidence) : null,
    patientId: row.patient_id != null ? String(row.patient_id) : null,
  };
}

async function persistJobSummaryMetadata(
  supabase: SupabaseClient,
  tenantId: string,
  imageId: string,
  kind: "density_estimate" | "norwood_grade" | "outcome_score",
  summary: ReadOnlyJobSummary | OutcomeSignalSummary | NorwoodSignalSummary
): Promise<Record<string, unknown>> {
  const ctx = await loadPatientImageContext(supabase, tenantId, imageId);
  const merged = mergeImagingJobSummariesMetadata(ctx.metadata, { [kind]: summary });
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_patient_images")
    .update({ metadata: merged, updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("id", imageId);
  if (error) throw new Error(error.message);
  return merged;
}

export async function processImagingAiAnalysisJob(
  job: ImagingAiAnalysisJobRow,
  client?: SupabaseClient
): Promise<ProcessImagingAiJobResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = job.tenant_id;
  const imageId = job.patient_image_id;

  try {
    const hasRegionLink = await loadRegionLinkExists(supabase, tid, imageId);

    if (job.analysis_kind === "donor_assessment") {
      const donor = await assessFiOsPatientDonorAndPersist({
        tenantId: tid,
        patientImageId: imageId,
        client: supabase,
      });
      await completeImagingAiAnalysisJob({
        tenantId: tid,
        jobId: job.id,
        resultPayload: {
          persisted_id: donor.persistedId,
          assessor_version: donor.assessorVersion,
          confidence_score: donor.result.confidence_score,
          donor_quality_rating: donor.result.donor_quality_rating,
        },
        client: supabase,
      });
      return { jobId: job.id, status: "completed", analysisKind: job.analysis_kind };
    }

    if (job.analysis_kind === "recipient_assessment") {
      const recipient = await assessFiOsPatientRecipientAndPersist({
        tenantId: tid,
        patientImageId: imageId,
        client: supabase,
      });
      await completeImagingAiAnalysisJob({
        tenantId: tid,
        jobId: job.id,
        resultPayload: {
          persisted_id: recipient.persistedId,
          assessor_version: recipient.assessorVersion,
          confidence_score: recipient.result.confidence_score,
          recipient_quality_rating: recipient.result.recipient_quality_rating,
        },
        client: supabase,
      });
      return { jobId: job.id, status: "completed", analysisKind: job.analysis_kind };
    }

    if (job.analysis_kind === "density_estimate") {
      const ctx = await loadPatientImageContext(supabase, tid, imageId);
      const flags = parseImagingLiveProviderFlags(process.env);
      const providerCtx = resolveLiveImagingSignalProvider(process.env);
      const summary = buildLiveDensitySignalSummary({
        metadata: ctx.metadata,
        aiImageCategory: ctx.aiImageCategory,
        aiImageCategoryConfidence: ctx.aiImageCategoryConfidence,
        liveEnabled: flags.liveDensityEnabled,
        providerAvailable: providerCtx.providerAvailable,
        providerName: providerCtx.providerName,
      });
      await persistJobSummaryMetadata(supabase, tid, imageId, "density_estimate", summary);
      await completeImagingAiAnalysisJob({
        tenantId: tid,
        jobId: job.id,
        resultPayload: { summary },
        client: supabase,
      });
      return { jobId: job.id, status: "completed", analysisKind: job.analysis_kind };
    }

    if (job.analysis_kind === "norwood_grade") {
      const ctx = await loadPatientImageContext(supabase, tid, imageId);
      const providerCtx = resolveLiveImagingSignalProvider(process.env);
      const summary = buildLiveNorwoodSignalSummary({
        metadata: ctx.metadata,
        aiImageCategory: ctx.aiImageCategory,
        aiImageCategoryConfidence: ctx.aiImageCategoryConfidence,
        liveEnabled: parseImagingNorwoodProviderFlag(process.env),
        providerAvailable: providerCtx.providerAvailable,
        providerName: providerCtx.providerName,
      });
      await persistJobSummaryMetadata(supabase, tid, imageId, "norwood_grade", summary);
      await completeImagingAiAnalysisJob({
        tenantId: tid,
        jobId: job.id,
        resultPayload: { summary },
        client: supabase,
      });
      return { jobId: job.id, status: "completed", analysisKind: job.analysis_kind };
    }

    if (job.analysis_kind === "outcome_score") {
      const ctx = await loadPatientImageContext(supabase, tid, imageId);
      const flags = parseImagingLiveProviderFlags(process.env);
      const providerCtx = resolveLiveImagingSignalProvider(process.env);
      const summary = buildLiveOutcomeScoreSignalSummary({
        metadata: ctx.metadata,
        aiImageCategoryConfidence: ctx.aiImageCategoryConfidence,
        liveEnabled: flags.liveOutcomeEnabled,
        providerAvailable: providerCtx.providerAvailable,
        providerName: providerCtx.providerName,
      });
      await persistJobSummaryMetadata(supabase, tid, imageId, "outcome_score", summary);
      await completeImagingAiAnalysisJob({
        tenantId: tid,
        jobId: job.id,
        resultPayload: { summary },
        client: supabase,
      });
      return { jobId: job.id, status: "completed", analysisKind: job.analysis_kind };
    }

    if (job.analysis_kind === "clinical_image_analysis") {
      const outcome = await runClinicalImageAnalysis({
        tenantId: tid,
        patientImageId: imageId,
        hasRegionLink,
        client: supabase,
      });
      await persistClinicalImageAnalysisMetadata({
        tenantId: tid,
        patientImageId: imageId,
        metadata: outcome.mergedMetadata,
        client: supabase,
      });
      await completeImagingAiAnalysisJob({
        tenantId: tid,
        jobId: job.id,
        resultPayload: {
          imaging_clinical_ai: clinicalAnalysisResultToMetadataRecord(outcome.result),
          used_open_ai: outcome.usedOpenAi,
        },
        client: supabase,
      });
      return { jobId: job.id, status: "completed", analysisKind: job.analysis_kind };
    }

    await failImagingAiAnalysisJob({
      tenantId: tid,
      jobId: job.id,
      errorMessage: `Unsupported analysis kind: ${job.analysis_kind}`,
      retry: false,
      client: supabase,
    });
    return { jobId: job.id, status: "failed", analysisKind: job.analysis_kind };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "job processing failed";
    await failImagingAiAnalysisJob({
      tenantId: tid,
      jobId: job.id,
      errorMessage: message,
      client: supabase,
    });
    const attempts =
      typeof job.request_payload.attempt_count === "number"
        ? job.request_payload.attempt_count
        : 0;
    return {
      jobId: job.id,
      status: attempts + 1 < 2 ? "requeued" : "failed",
      analysisKind: job.analysis_kind,
    };
  }
}

export async function processPendingImagingAiJobsForTenant(input: {
  tenantId: string;
  limit?: number;
  client?: SupabaseClient;
}): Promise<ProcessImagingAiJobResult[]> {
  const supabase = input.client ?? supabaseAdmin();
  const limit = Math.max(1, Math.min(input.limit ?? 5, 20));
  const results: ProcessImagingAiJobResult[] = [];

  for (let i = 0; i < limit; i++) {
    const job = await claimNextImagingAiAnalysisJob({
      tenantId: input.tenantId,
      client: supabase,
    });
    if (!job) break;
    results.push(await processImagingAiAnalysisJob(job, supabase));
  }

  return results;
}