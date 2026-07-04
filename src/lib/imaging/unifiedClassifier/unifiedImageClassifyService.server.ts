import "server-only";

import type { ImageClassificationResultV1, NormalizedImageSignalV1 } from "@follicle/intelligence-core/contracts";
import { resolveHairauditClassifierMode } from "@/src/lib/security/hairauditClassifierAuth";
import {
  buildHairAuditClassificationFromHli,
  buildDegradedHairAuditClassification,
} from "@/src/lib/hairaudit/hairAuditClassifierResponseMap";
import type { HairAuditImageClassifyResponse } from "@/src/lib/hairaudit/fiOsHairAuditImageClassifyService";
import {
  buildImageClassificationResultV1,
  buildNormalizedImageSignalV1,
} from "./contractMapping";
import {
  classifyWithImagingOsStub,
  classifyWithLiveHieStack,
  UNIFIED_LIVE_PROVIDER,
} from "./liveHieClassifier.server";
import {
  logImagingClassifierAlert,
  logImagingClassifierEvent,
} from "./imagingClassifierObservability";
import { resolveFiOsClassifierCaptureSource } from "@/src/lib/imaging-os/imagingCaptureSourceCore";
import type { UnifiedImageClassifyRequest } from "./unifiedImageClassifyRequest";

type SourceSystemCaptureDefaults = {
  resolveCaptureSource: (request: UnifiedImageClassifyRequest) => string;
  defaultUploadSource: string;
};

export const SOURCE_CAPTURE_DEFAULTS: Partial<
  Record<UnifiedImageClassifyRequest["source_system"], SourceSystemCaptureDefaults>
> = {
  fi_os: {
    resolveCaptureSource: (request) =>
      resolveFiOsClassifierCaptureSource(request.capture_source),
    defaultUploadSource: "fi_os",
  },
  hairaudit: {
    resolveCaptureSource: (request) => request.capture_source ?? "forensic_audit",
    defaultUploadSource: "hairaudit",
  },
  hli: {
    resolveCaptureSource: (request) => request.capture_source ?? "patient_portal",
    defaultUploadSource: "hli",
  },
  iiohr: {
    resolveCaptureSource: (request) => request.capture_source ?? "clinic_staff",
    defaultUploadSource: "iiohr",
  },
};

function applyIiohrMetadata(
  request: UnifiedImageClassifyRequest
): UnifiedImageClassifyRequest["metadata"] {
  return {
    academy_case_id: request.metadata?.academy_case_id ?? request.case_id ?? null,
    professional_id: request.metadata?.professional_id ?? request.professional_id ?? null,
    global_professional_id: request.metadata?.global_professional_id ?? null,
    ...request.metadata,
  };
}

export function applySourceDefaults(
  request: UnifiedImageClassifyRequest
): UnifiedImageClassifyRequest {
  const defaults = SOURCE_CAPTURE_DEFAULTS[request.source_system];
  if (!defaults) return request;

  const next: UnifiedImageClassifyRequest = {
    ...request,
    capture_source: defaults.resolveCaptureSource(request),
    upload_source: request.upload_source ?? defaults.defaultUploadSource,
  };

  if (request.source_system === "iiohr") {
    next.metadata = applyIiohrMetadata(request);
  }

  return next;
}

export type UnifiedImageClassifyResponse = {
  success: boolean;
  classification: ImageClassificationResultV1;
  normalized_signal: NormalizedImageSignalV1;
  fallback_used: boolean;
  provider: string;
  processing_version: string;
  warnings: string[];
  generated_at: string;
  error?: { code: string; message: string };
};

export type UnifiedImageClassifyOutcome =
  | { ok: true; result: UnifiedImageClassifyResponse }
  | { ok: false; code: string; message: string; httpStatus: number };

export async function classifyUnifiedImageRequest(
  rawRequest: UnifiedImageClassifyRequest,
  env: NodeJS.ProcessEnv = process.env
): Promise<UnifiedImageClassifyOutcome> {
  const started = Date.now();
  const request = applySourceDefaults(rawRequest);

  logImagingClassifierEvent("fi_imaging_classifier_request", {
    source_system: request.source_system,
    source_image_id: request.source_image_id,
  });

  const useHairAuditStub =
    request.source_system === "hairaudit" && resolveHairauditClassifierMode(env) === "stub";

  const liveOutcome = useHairAuditStub
    ? classifyWithImagingOsStub(request)
    : await classifyWithLiveHieStack(request, env);

  if (!liveOutcome.hliResult) {
    logImagingClassifierAlert("live classifier returned null structured result", {
      source_system: request.source_system,
      provider: liveOutcome.provider,
    });
    logImagingClassifierEvent("fi_imaging_classifier_null_result", {
      source_system: request.source_system,
    });
  }

  if (liveOutcome.fallbackUsed) {
    logImagingClassifierEvent("fi_imaging_classifier_fallback", {
      source_system: request.source_system,
      provider: liveOutcome.provider,
      fallback_used: true,
    });
  }

  const classification = buildImageClassificationResultV1({
    request,
    hliResult: liveOutcome.hliResult,
    provider: liveOutcome.provider,
    processingVersion: liveOutcome.processingVersion,
    fallbackUsed: liveOutcome.fallbackUsed,
    externalCategoryHint: request.canonical_photo_category,
    legacyUploadType: request.legacy_upload_type,
  });

  if (classification.metadata.category_alias_used === true) {
    logImagingClassifierEvent("fi_imaging_classifier_category_alias", {
      source_system: request.source_system,
      category: classification.category ?? null,
    });
  }

  const normalized_signal = buildNormalizedImageSignalV1({
    request,
    classification,
    processingVersion: liveOutcome.processingVersion,
  });

  const latencyMs = Date.now() - started;
  logImagingClassifierEvent("fi_imaging_classifier_success", {
    source_system: request.source_system,
    provider: liveOutcome.provider,
    processing_version: liveOutcome.processingVersion,
    fallback_used: liveOutcome.fallbackUsed,
    latency_ms: latencyMs,
    null_result: false,
  });

  const success = !liveOutcome.fallbackUsed || liveOutcome.provider === UNIFIED_LIVE_PROVIDER;

  return {
    ok: true,
    result: {
      success,
      classification,
      normalized_signal,
      fallback_used: liveOutcome.fallbackUsed,
      provider: liveOutcome.provider,
      processing_version: liveOutcome.processingVersion,
      warnings: liveOutcome.warnings,
      generated_at: new Date().toISOString(),
      ...(liveOutcome.fallbackUsed && liveOutcome.provider !== UNIFIED_LIVE_PROVIDER
        ? {
            error: {
              code: "classifier_fallback",
              message: liveOutcome.warnings.join("; ") || "Classifier used fallback path",
            },
          }
        : {}),
    },
  };
}

/** Map unified V1 response to legacy HairAudit 7-field contract. */
export function mapUnifiedResultToHairAuditResponse(
  unified: UnifiedImageClassifyResponse,
  request: UnifiedImageClassifyRequest
): HairAuditImageClassifyResponse {
  if (unified.provider === "fi-os-stub-v1") {
    const hliCategory = unified.classification.category === "donor" ? "donor" : "front";
    return buildHairAuditClassificationFromHli({
      hliCategory,
      categoryConfidence: unified.classification.confidence,
      classifierVersion: unified.processing_version,
      notes: unified.warnings.join("; ") || "Stub classification only",
      fallbackExternalCategory: request.canonical_photo_category ?? "patient_current_front",
    });
  }

  if (unified.fallback_used) {
    return buildDegradedHairAuditClassification({
      canonical_photo_category: request.canonical_photo_category ?? "unknown",
      legacy_upload_type: request.legacy_upload_type,
      classifier_version: unified.processing_version,
      reason: unified.warnings.join("; ") || "classifier fallback",
    });
  }

  const category = unified.classification.category ?? "front";
  const hliCategoryMap: Record<string, Parameters<typeof buildHairAuditClassificationFromHli>[0]["hliCategory"]> = {
    front: "front",
    left_temple: "left_profile",
    right_temple: "right_profile",
    crown: "crown",
    donor: "donor",
    graft_tray: "graft_tray",
    immediate_post_op: "immediate_post_op",
    follow_up: "follow_up",
    microscopic: "microscopic",
    wet_hair_top: "top",
    wet_hair_front: "front",
    hairline_closeup: "front",
    scalp_magnified: "microscopic",
    recipient: "unknown",
  };

  return buildHairAuditClassificationFromHli({
    hliCategory: hliCategoryMap[category] ?? "unknown",
    categoryConfidence: unified.classification.confidence,
    classifierVersion: unified.processing_version,
    notes: String(unified.classification.metadata.classifier_notes ?? ""),
    fallbackExternalCategory: request.canonical_photo_category ?? "patient_current_front",
  });
}
