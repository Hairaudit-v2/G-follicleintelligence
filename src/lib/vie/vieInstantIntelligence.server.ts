import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evaluateFiImageQuality } from "@/src/lib/patientImages/fiImageAttributionCore";
import { getVieProtocol } from "./vieProtocolCatalog";
import { loadVieCapturePolicyForTenant } from "./vieCapturePolicy.server";
import { deriveClinicalUsability } from "./vieQualityGate";
import type { VieInstantIntelligenceResult } from "./vieProtocolTypes";
import { VIE_ENGINE_VERSION } from "./vieProtocolTypes";

export const VIE_INTELLIGENCE_PIPELINE_VERSION = "vie-intelligence-stub.v2" as const;

export type RunVieInstantIntelligenceInput = {
  tenantId: string;
  patientId: string;
  patientImageId: string;
  protocolSessionId: string | null;
  protocolTemplateSlug: string;
  protocolSlotSlug: string;
  contentType: string;
  fileSizeBytes: number;
  imageWidth: number | null;
  imageHeight: number | null;
  protocolCompletion: {
    required_complete: number;
    required_total: number;
    percent: number;
    complete: boolean;
  };
};

function qualityBandFromScore(score: number): VieInstantIntelligenceResult["quality_band"] {
  if (score >= 85) return "excellent";
  if (score >= 65) return "acceptable";
  return "retake_recommended";
}

/**
 * Phase 2 instant intelligence — heuristic checks + clinical usability (no AI vision yet).
 */
export async function buildVieInstantIntelligenceStub(
  input: RunVieInstantIntelligenceInput,
  policy?: Awaited<ReturnType<typeof loadVieCapturePolicyForTenant>>
): Promise<VieInstantIntelligenceResult> {
  const protocol = getVieProtocol(input.protocolTemplateSlug);
  const slot = protocol?.slots.find((s) => s.slug === input.protocolSlotSlug);
  const capturePolicy = policy ?? (await loadVieCapturePolicyForTenant(input.tenantId));

  const { quality: qualityEval } = evaluateFiImageQuality({
    content_type: input.contentType,
    size_bytes: input.fileSizeBytes,
    width: input.imageWidth,
    height: input.imageHeight,
  });

  const signalNames = new Set(qualityEval.signals.map((s) => s.name));
  const qualityScore = Math.round(qualityEval.quality_score ?? 72);
  const qualityBand = qualityBandFromScore(qualityScore);

  const focusFail =
    signalNames.has("resolution") &&
    qualityEval.signals.some((s) => s.name === "resolution" && s.status === "fail");
  const lightingFail = qualityEval.signals.some(
    (s) => s.status === "fail" && (s.name === "file_size" || s.name === "aspect_ratio")
  );

  const partial = {
    quality_score: qualityScore,
    quality_band: qualityBand,
    focus_verification: {
      status: focusFail ? ("heuristic_fail" as const) : ("heuristic_pass" as const),
      blur_score: null,
      message: focusFail
        ? "Image may be blurry or low resolution — consider retaking."
        : "Focus check passed basic heuristics.",
    },
    lighting_verification: {
      status: lightingFail ? ("heuristic_fail" as const) : ("heuristic_pass" as const),
      exposure_score: null,
      message: qualityEval.warnings[0] ?? "Lighting check passed basic heuristics.",
    },
    classification: {
      status: "pending_ai" as const,
      expected_slot: input.protocolSlotSlug,
      expected_region: slot?.suggested_region ?? "unknown",
      message:
        "AI classification queued — slot and region will be verified when vision engine is enabled.",
    },
    angle_verification: {
      status: "pending_ai" as const,
      expected_guide: slot?.capture_guide ?? "front_hairline",
      message: "Angle verification pending AI vision — follow on-screen capture guide for now.",
    },
  };

  const clinical_usability = deriveClinicalUsability(partial, capturePolicy);

  return {
    engine_version: VIE_ENGINE_VERSION,
    pipeline_version: VIE_INTELLIGENCE_PIPELINE_VERSION,
    patient_image_id: input.patientImageId,
    protocol_template_slug: input.protocolTemplateSlug,
    protocol_slot_slug: input.protocolSlotSlug,
    classification: partial.classification,
    angle_verification: partial.angle_verification,
    focus_verification: partial.focus_verification,
    lighting_verification: partial.lighting_verification,
    quality_score: qualityScore,
    quality_band: qualityBand,
    clinical_usability,
    acceptance_status: "pending",
    protocol_completion: input.protocolCompletion,
  };
}

export async function persistVieCaptureIntelligence(
  input: RunVieInstantIntelligenceInput,
  result: VieInstantIntelligenceResult,
  client?: SupabaseClient
): Promise<string> {
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_vie_capture_intelligence")
    .insert({
      tenant_id: input.tenantId.trim(),
      patient_id: input.patientId.trim(),
      patient_image_id: input.patientImageId.trim(),
      protocol_session_id: input.protocolSessionId?.trim() || null,
      protocol_template_slug: input.protocolTemplateSlug.trim(),
      protocol_slot_slug: input.protocolSlotSlug.trim(),
      classification: result.classification,
      angle_verification: result.angle_verification,
      focus_verification: result.focus_verification,
      lighting_verification: result.lighting_verification,
      quality_score: result.quality_score,
      quality_band: result.quality_band,
      clinically_usable: result.clinical_usability.clinically_usable,
      clinical_usability: result.clinical_usability,
      warnings: result.clinical_usability.warnings,
      retake_recommendation: result.clinical_usability.retake_recommendation,
      acceptance_status: "pending",
      protocol_completion: result.protocol_completion,
      pipeline_version: result.pipeline_version,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String((data as { id: string }).id);
}

export async function runVieInstantIntelligence(
  input: RunVieInstantIntelligenceInput,
  client?: SupabaseClient
): Promise<VieInstantIntelligenceResult & { intelligence_id: string }> {
  const policy = await loadVieCapturePolicyForTenant(input.tenantId, client);
  const result = await buildVieInstantIntelligenceStub(input, policy);
  const intelligence_id = await persistVieCaptureIntelligence(input, result, client);
  return { ...result, intelligence_id };
}
