import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getVieProtocol } from "@/src/lib/vie/vieProtocolCatalog";
import {
  evaluateImagingQuality,
  readClientCaptureHintsFromMetadata,
  type ImagingQualityEvaluationInput,
  type ImagingQualityEvaluationResult,
  type ImagingQualityProtocolContext,
} from "./imageQualityCore";
import { detectDuplicateInProtocolSession } from "./imageDuplicateDetection.server";
import { computeImageFingerprint } from "./imageFingerprint.server";
import {
  buildImagingQualityMetadataRecord,
  type ImagingQualityMetadataRecord,
} from "./imageQualityMetadata";
import type { ImagingQualityTenantPolicy } from "./imageQualityPolicy";
import { loadImagingQualityPolicyForTenant } from "./imageQualityPolicy.server";
import { evaluateImageSharpnessHeuristic } from "./imageSharpnessHeuristic.server";

export type RunImagingQualityEvaluationInput = {
  tenantId: string;
  patientId?: string | null;
  imageBuffer?: Buffer | null;
  width?: number | null;
  height?: number | null;
  size_bytes?: number | null;
  content_type?: string | null;
  metadata?: Record<string, unknown>;
  capture_source?: string | null;
  protocol_session_id?: string | null;
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  storage_path?: string | null;
  policy?: ImagingQualityTenantPolicy;
  client?: SupabaseClient;
  skip_server_heuristic?: boolean;
};

export type RunImagingQualityEvaluationResult = {
  evaluation: ImagingQualityEvaluationResult;
  metadata_record: ImagingQualityMetadataRecord;
  fingerprint: { content_hash: string; perceptual_hash: string } | null;
};

function buildProtocolContext(input: RunImagingQualityEvaluationInput): ImagingQualityProtocolContext {
  const template = input.protocol_template_slug?.trim();
  const slot = input.protocol_slot_slug?.trim();
  const protocol = template ? getVieProtocol(template) : null;
  const slotDef = protocol?.slots.find((s) => s.slug === slot);
  const missing: string[] = [];
  if (!input.capture_source?.trim()) missing.push("capture_source");
  if (!input.protocol_session_id?.trim() && input.capture_source !== "hairaudit") {
    // HairAudit ingest may not have live protocol sessions.
  }

  return {
    capture_source: input.capture_source ?? null,
    protocol_session_id: input.protocol_session_id ?? null,
    protocol_template_slug: template ?? null,
    protocol_slot_slug: slot ?? null,
    slot_required: slotDef?.required ?? false,
    is_audit_context:
      String(input.capture_source ?? "")
        .toLowerCase()
        .includes("hairaudit") ||
      String(input.metadata?.upload_source ?? "") === "hairaudit",
  };
}

export async function runImagingQualityEvaluation(
  input: RunImagingQualityEvaluationInput
): Promise<RunImagingQualityEvaluationResult> {
  const policy = input.policy ?? (await loadImagingQualityPolicyForTenant(input.tenantId, input.client));
  const metadata = input.metadata ?? {};
  const clientHints = readClientCaptureHintsFromMetadata(metadata);

  const heuristic = input.skip_server_heuristic
    ? { blur_status: "unknown" as const, exposure_status: "unknown" as const, sharpness_score: null }
    : await evaluateImageSharpnessHeuristic(input.imageBuffer ?? null);

  const fingerprint = input.imageBuffer ? await computeImageFingerprint(input.imageBuffer) : null;

  const duplicate =
    input.patientId && input.protocol_session_id
      ? await detectDuplicateInProtocolSession({
          tenantId: input.tenantId,
          patientId: input.patientId,
          protocolSessionId: input.protocol_session_id,
          content_hash: fingerprint?.content_hash ?? null,
          perceptual_hash: fingerprint?.perceptual_hash ?? null,
          protocol_slot_slug: input.protocol_slot_slug ?? null,
          storage_path: input.storage_path ?? null,
          client: input.client,
        })
      : { duplicate_status: "unique" as const, matched_image_id: null };

  const protocolContext = buildProtocolContext(input);
  const missingRequired: string[] = [];
  if (!input.width || !input.height) missingRequired.push("dimensions");

  const evalInput: ImagingQualityEvaluationInput = {
    image_metadata: {
      width: input.width,
      height: input.height,
      size_bytes: input.size_bytes,
      content_type: input.content_type,
      missing_required_fields: missingRequired,
    },
    client_hints: clientHints,
    server_heuristic: heuristic,
    duplicate_signal: { duplicate_status: duplicate.duplicate_status },
    protocol_context: protocolContext,
    policy,
  };

  const evaluation = evaluateImagingQuality(evalInput);
  const metadata_record = buildImagingQualityMetadataRecord({
    evaluation,
    sharpness_score: heuristic.sharpness_score ?? null,
    blur_status: heuristic.blur_status ?? "unknown",
    exposure_status: heuristic.exposure_status ?? "unknown",
    duplicate_status: duplicate.duplicate_status,
    content_hash: fingerprint?.content_hash ?? null,
    perceptual_hash: fingerprint?.perceptual_hash ?? null,
  });

  return { evaluation, metadata_record, fingerprint };
}