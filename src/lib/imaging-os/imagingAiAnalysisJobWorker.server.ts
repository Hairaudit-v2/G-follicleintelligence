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

export type ProcessImagingAiJobResult = {
  jobId: string;
  status: "completed" | "failed" | "requeued";
  analysisKind: string;
};

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