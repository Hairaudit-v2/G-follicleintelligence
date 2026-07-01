import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { classifyClinicalHairImageFromModelUrl } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImage.server";
import { isOpenAiApiKeyConfigured } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImageFallback";
import { assessFiOsPatientDonorAndPersist } from "@/src/lib/hair-intelligence/donorIntelligence/adapters/fiOsDonorAssessment.server";
import { assessFiOsPatientRecipientAndPersist } from "@/src/lib/hair-intelligence/recipientCandidacy/adapters/fiOsRecipientAssessment.server";
import { resolveHairauditClassifierMode } from "@/src/lib/security/hairauditClassifierAuth";
import { createPatientImageSignedUrls } from "@/src/lib/patientImages/patientImagesServer";
import {
  buildClinicalImageAnalysisFromHli,
  buildDonorAssessmentSummary,
  buildRecipientAssessmentSummary,
  buildStubClinicalImageAnalysis,
  buildUnavailableClinicalImageAnalysis,
  clinicalAnalysisResultToMetadataRecord,
  mergeClinicalAnalysisWithAssessments,
  mergeImagingClinicalAiMetadata,
  donorModelResultToObservations,
  recipientModelResultToObservations,
  shouldRunDonorAssessment,
  shouldRunRecipientAssessment,
  type ClinicalImageAnalysisResult,
  type ImagingClinicalAiMetadataRecord,
} from "./clinicalImageAnalysisCore";
import { evaluateScalpRegionCompliance } from "./scalpRegionEnforcement";

export type RunClinicalImageAnalysisInput = {
  tenantId: string;
  patientImageId: string;
  storageBucket?: string;
  storagePath?: string;
  externalCategory?: string;
  legacyUploadType?: string | null;
  protocolSlotSlug?: string | null;
  anatomicalRegion?: string | null;
  captureSource?: string | null;
  protocolSessionId?: string | null;
  runDonorAssessment?: boolean;
  runRecipientAssessment?: boolean;
  hasRegionLink?: boolean;
  isAdminFallback?: boolean;
  client?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
};

export type RunClinicalImageAnalysisOutcome = {
  result: ClinicalImageAnalysisResult;
  metadataRecord: ImagingClinicalAiMetadataRecord;
  mergedMetadata: Record<string, unknown>;
  usedOpenAi: boolean;
};

function resolveClinicalProviderMode(env: NodeJS.ProcessEnv): "stub" | "live" {
  return resolveHairauditClassifierMode(env) === "stub" ? "stub" : "live";
}

async function loadPatientImageRow(
  supabase: SupabaseClient,
  tenantId: string,
  patientImageId: string
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", patientImageId)
    .eq("image_status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient image not found.");
  return data as Record<string, unknown>;
}

async function resolveSignedModelUrl(
  supabase: SupabaseClient,
  imageId: string,
  bucket: string,
  path: string
): Promise<string | null> {
  const signedMap = await createPatientImageSignedUrls(
    [{ id: imageId, storage_bucket: bucket, storage_path: path }],
    supabase
  );
  return signedMap.get(imageId)?.url ?? null;
}

/**
 * Single orchestration point for ImagingOS clinical image intelligence (HLI OpenAI).
 * Fails safely with degraded/stub results; staff-facing metadata only.
 */
export async function runClinicalImageAnalysis(
  input: RunClinicalImageAnalysisInput
): Promise<RunClinicalImageAnalysisOutcome> {
  const env = input.env ?? process.env;
  const supabase = input.client ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const iid = input.patientImageId.trim();

  const row = await loadPatientImageRow(supabase, tid, iid);
  const bucket = String(input.storageBucket ?? row.storage_bucket ?? "patient-images");
  const path = String(input.storagePath ?? row.storage_path ?? "");
  const existingMetadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};

  const protocolSlotSlug =
    input.protocolSlotSlug ?? (row.imaging_protocol_slot_slug as string | null);
  const anatomicalRegion = input.anatomicalRegion ?? (row.anatomical_region as string | null);
  const captureSource =
    input.captureSource ??
    (typeof existingMetadata.capture_source === "string"
      ? existingMetadata.capture_source
      : (existingMetadata.fi_image_metadata as { capture_source?: string } | undefined)
          ?.capture_source);
  const protocolSessionId =
    input.protocolSessionId ??
    (typeof existingMetadata.protocol_session_id === "string"
      ? existingMetadata.protocol_session_id
      : null);

  const scalpCompliance = evaluateScalpRegionCompliance({
    captureSource,
    protocolSessionId,
    protocolSlotSlug,
    anatomicalRegion,
    hasRegionLink: input.hasRegionLink ?? false,
    isAdminFallback: input.isAdminFallback ?? captureSource === "appointment_procedure_admin_fallback",
    capturedBeforeEnforcement: !protocolSessionId && !protocolSlotSlug,
  });

  const mode = resolveClinicalProviderMode(env);
  let base: ClinicalImageAnalysisResult;
  let usedOpenAi = false;

  if (mode === "stub" || !isOpenAiApiKeyConfigured()) {
    base = buildStubClinicalImageAnalysis({
      externalCategory:
        input.externalCategory ??
        String(row.ai_image_category ?? row.image_category ?? "other"),
      legacyUploadType: input.legacyUploadType,
      idempotencyKey: iid,
    });
    if (!isOpenAiApiKeyConfigured() && mode === "live") {
      base = {
        ...base,
        provider: "unavailable",
        status: "needs_review",
        reviewRequired: true,
        reasons: [...base.reasons, "openai_not_configured"],
      };
    }
  } else {
    if (!path) {
      base = buildUnavailableClinicalImageAnalysis({
        reason: "missing_storage_path",
        viewType: String(row.ai_image_category ?? "other"),
      });
    } else {
      try {
        const signedUrl = await resolveSignedModelUrl(supabase, iid, bucket, path);
        if (!signedUrl) {
          base = buildUnavailableClinicalImageAnalysis({
            reason: "signed_url_unavailable",
            viewType: String(row.ai_image_category ?? "other"),
          });
        } else {
          const { result, usedOpenAi: openAiUsed } = await classifyClinicalHairImageFromModelUrl({
            imageUrlForModel: signedUrl,
          });
          usedOpenAi = openAiUsed;
          const extraReasons = scalpCompliance.reviewRequired ? [...scalpCompliance.reasons] : [];
          base = buildClinicalImageAnalysisFromHli({
            hliCategory: result.category,
            categoryConfidence: result.categoryConfidence,
            hairState: result.hairState,
            shaveState: result.shaveState,
            surgeryStage: result.surgeryStage,
            notes: result.notes,
            extraReasons,
          });
        }
      } catch (e: unknown) {
        base = buildUnavailableClinicalImageAnalysis({
          reason: e instanceof Error ? e.message : "live_analysis_failed",
          viewType: String(row.ai_image_category ?? "other"),
        });
      }
    }
  }

  if (scalpCompliance.reviewRequired) {
    base = {
      ...base,
      reviewRequired: true,
      status: base.status === "failed" ? "failed" : "needs_review",
      reasons: [...new Set([...base.reasons, ...scalpCompliance.reasons, "missing_scalp_region"])],
      clinicalFindings: {
        ...base.clinicalFindings,
        scalpRegion: {
          expected_kind: scalpCompliance.expectedRegionKind,
          passes: scalpCompliance.passes,
          review_required: scalpCompliance.reviewRequired,
        },
      },
    };
  }

  const runDonor =
    input.runDonorAssessment ??
    shouldRunDonorAssessment({
      viewType: base.viewType,
      protocolSlotSlug,
      anatomicalRegion,
      hliCategory: null,
    });
  const runRecipient =
    input.runRecipientAssessment ??
    shouldRunRecipientAssessment({
      viewType: base.viewType,
      protocolSlotSlug,
      anatomicalRegion,
      hliCategory: null,
    });

  let donorSummary;
  let recipientSummary;
  let donorFindings: Record<string, unknown> | undefined;
  let recipientFindings: Record<string, unknown> | undefined;

  if (runDonor && mode === "live" && isOpenAiApiKeyConfigured()) {
    try {
      const donor = await assessFiOsPatientDonorAndPersist({
        tenantId: tid,
        patientImageId: iid,
        client: supabase,
      });
      const observations = donorModelResultToObservations(donor.result);
      donorSummary = buildDonorAssessmentSummary({
        confidence: donor.result.confidence_score,
        observations,
        reviewRequired: donor.result.confidence_score < 0.65,
      });
      donorFindings = {
        donor_quality_rating: donor.result.donor_quality_rating,
        donor_region: donor.result.donor_region,
        assessor_version: donor.assessorVersion,
        persisted_id: donor.persistedId,
      };
    } catch {
      donorSummary = buildDonorAssessmentSummary({
        confidence: 0,
        observations: ["Donor assessment unavailable for this capture."],
        status: "unavailable",
        reviewRequired: true,
      });
    }
  }

  if (runRecipient && mode === "live" && isOpenAiApiKeyConfigured()) {
    try {
      const recipient = await assessFiOsPatientRecipientAndPersist({
        tenantId: tid,
        patientImageId: iid,
        client: supabase,
      });
      const observations = recipientModelResultToObservations(recipient.result);
      recipientSummary = buildRecipientAssessmentSummary({
        confidence: recipient.result.confidence_score,
        observations,
        reviewRequired:
          recipient.result.confidence_score < 0.65 ||
          recipient.result.documentation_gap_detected,
      });
      recipientFindings = {
        recipient_quality_rating: recipient.result.recipient_quality_rating,
        assessor_version: recipient.assessorVersion,
        persisted_id: recipient.persistedId,
      };
    } catch {
      recipientSummary = buildRecipientAssessmentSummary({
        confidence: 0,
        observations: ["Recipient assessment unavailable for this capture."],
        status: "unavailable",
        reviewRequired: true,
      });
    }
  }

  const result = mergeClinicalAnalysisWithAssessments(base, {
    donor: donorSummary,
    recipient: recipientSummary,
    donorFindings,
    recipientFindings,
  });

  const metadataRecord = clinicalAnalysisResultToMetadataRecord(result);
  const mergedMetadata = mergeImagingClinicalAiMetadata(existingMetadata, metadataRecord);

  return { result, metadataRecord, mergedMetadata, usedOpenAi };
}

export async function persistClinicalImageAnalysisMetadata(
  input: RunClinicalImageAnalysisInput & { metadata: Record<string, unknown> }
): Promise<void> {
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_patient_images")
    .update({
      metadata: input.metadata,
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId.trim())
    .eq("id", input.patientImageId.trim());
  if (error) throw new Error(error.message);
}