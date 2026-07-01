import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { classifyClinicalHairImageFromModelUrl as classifyWithHli } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImage.server";
import {
  hairImageClassificationNotConfiguredResult,
  isOpenAiApiKeyConfigured,
} from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImageFallback";
import { HLI_IMAGE_CLASSIFIER_VERSION } from "@/src/lib/hair-intelligence/imageClassification/openAiHairImageClassifier.server";
import type { FiAiImageClassificationResult } from "@/src/lib/hair-intelligence/imageClassification/types";
import { mapExternalLabelToPhotoCategoryV1 } from "./categoryMapping";
import type { UnifiedImageClassifyRequest } from "./unifiedImageClassifyRequest";

export const UNIFIED_LIVE_PROVIDER = "hli-openai-vision" as const;
export const UNIFIED_FALLBACK_PROVIDER = "fi-os-classifier-fallback" as const;
export const UNIFIED_STUB_PROVIDER = "fi-os-stub-v1" as const;

const SIGNED_URL_TTL_SEC = 300;

export type LiveHieClassifierOutcome = {
  hliResult: FiAiImageClassificationResult;
  provider: string;
  processingVersion: string;
  fallbackUsed: boolean;
  warnings: string[];
};

async function createStorageSignedUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .storage.from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function resolveModelImageUrl(
  request: UnifiedImageClassifyRequest
): Promise<{ url: string | null; warning?: string }> {
  const directUrl = request.signed_url?.trim() || request.image_url?.trim();
  if (directUrl) return { url: directUrl };

  const bucket = request.storage_bucket?.trim();
  const path = request.storage_path?.trim();
  if (!bucket || !path) {
    return { url: null, warning: "missing image URL or storage reference" };
  }

  const signed = await createStorageSignedUrl(bucket, path);
  if (!signed) {
    return { url: null, warning: "could not create signed URL for storage reference" };
  }
  return { url: signed };
}

function buildFallbackHliResult(input: {
  request: UnifiedImageClassifyRequest;
  reason: string;
}): FiAiImageClassificationResult {
  const hint = input.request.canonical_photo_category ?? "unknown";
  const mapped = mapExternalLabelToPhotoCategoryV1(
    hint,
    input.request.legacy_upload_type ?? null
  );

  return {
    category: mapped.category === "front" ? "front" : "unknown",
    categoryConfidence: 0.45,
    hairState: "unknown",
    shaveState: "unknown",
    surgeryStage: "unknown",
    notes: `Fallback classification: ${input.reason}`,
  };
}

/**
 * Live HIE classifier path — always returns structured output (never null).
 * Root-cause fix: bypasses the HairAudit wrapper's early null return and dynamic-import gate.
 */
export async function classifyWithLiveHieStack(
  request: UnifiedImageClassifyRequest,
  env: NodeJS.ProcessEnv = process.env
): Promise<LiveHieClassifierOutcome> {
  const warnings: string[] = [];

  if (!isOpenAiApiKeyConfigured()) {
    warnings.push("OPENAI_API_KEY not configured");
    return {
      hliResult: buildFallbackHliResult({
        request,
        reason: "OPENAI_API_KEY not configured",
      }),
      provider: UNIFIED_FALLBACK_PROVIDER,
      processingVersion: `${HLI_IMAGE_CLASSIFIER_VERSION};mode=fallback`,
      fallbackUsed: true,
      warnings,
    };
  }

  const resolved = await resolveModelImageUrl(request);
  if (!resolved.url) {
    warnings.push(resolved.warning ?? "image URL unavailable");
    return {
      hliResult: buildFallbackHliResult({
        request,
        reason: resolved.warning ?? "image URL unavailable",
      }),
      provider: UNIFIED_FALLBACK_PROVIDER,
      processingVersion: `${HLI_IMAGE_CLASSIFIER_VERSION};mode=fallback`,
      fallbackUsed: true,
      warnings,
    };
  }

  try {
    const { result, classifierVersion, usedOpenAi } = await classifyWithHli({
      imageUrlForModel: resolved.url,
    });

    if (!usedOpenAi) {
      warnings.push("OpenAI classifier not used — configuration fallback");
      return {
        hliResult: result,
        provider: UNIFIED_FALLBACK_PROVIDER,
        processingVersion: classifierVersion,
        fallbackUsed: true,
        warnings,
      };
    }

    return {
      hliResult: result,
      provider: UNIFIED_LIVE_PROVIDER,
      processingVersion: classifierVersion,
      fallbackUsed: false,
      warnings,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "live classifier failed";
    warnings.push(message);
    return {
      hliResult: buildFallbackHliResult({ request, reason: message }),
      provider: UNIFIED_FALLBACK_PROVIDER,
      processingVersion: `${HLI_IMAGE_CLASSIFIER_VERSION};mode=fallback`,
      fallbackUsed: true,
      warnings,
    };
  }
}

/** Deterministic stub for HairAudit rollback mode and offline tests. */
export function classifyWithImagingOsStub(
  request: UnifiedImageClassifyRequest
): LiveHieClassifierOutcome {
  const hint = request.canonical_photo_category ?? "unknown";
  const mapped = mapExternalLabelToPhotoCategoryV1(hint, request.legacy_upload_type ?? null);

  const category =
    mapped.category === "donor"
      ? "donor"
      : mapped.category === "front"
        ? "front"
        : mapped.category === "crown"
          ? "crown"
          : "unknown";

  return {
    hliResult: {
      category,
      categoryConfidence: 0.6,
      hairState: "unknown",
      shaveState: "unknown",
      surgeryStage: "unknown",
      notes: "Stub classification only",
    },
    provider: UNIFIED_STUB_PROVIDER,
    processingVersion: UNIFIED_STUB_PROVIDER,
    fallbackUsed: true,
    warnings: ["stub mode"],
  };
}

export function notConfiguredFallbackResult(
  request: UnifiedImageClassifyRequest
): LiveHieClassifierOutcome {
  return {
    hliResult: hairImageClassificationNotConfiguredResult(),
    provider: UNIFIED_FALLBACK_PROVIDER,
    processingVersion: `${HLI_IMAGE_CLASSIFIER_VERSION};mode=not_configured`,
    fallbackUsed: true,
    warnings: ["classifier not configured"],
  };
}
