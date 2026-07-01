import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { classifyClinicalHairImageFromModelUrl as classifyWithHli } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImage.server";
import { classificationResultToHliInsert, insertHliImageClassificationRow } from "@/src/lib/hair-intelligence/imageClassification/persistHliClassification.server";
import { resolveHairauditClassifierMode } from "@/src/lib/security/hairauditClassifierAuth";
import {
  buildDegradedHairAuditClassification,
  buildHairAuditClassificationFromHli,
} from "./hairAuditClassifierResponseMap";
import type {
  ClinicalHairImageClassifierInput,
  ClinicalHairImageClassifierResult,
} from "./classifyClinicalHairImageFromModelUrl";
import { isOpenAiApiKeyConfigured } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImageFallback";

const SIGNED_URL_TTL_SEC = 300;
const LIVE_CLASSIFIER_VERSION = "hli-openai-hairaudit-live-v1" as const;

function isLiveClassifierMode(env: NodeJS.ProcessEnv): boolean {
  return resolveHairauditClassifierMode(env) === "live";
}

export function isClinicalHairImageClassifierAvailable(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return isLiveClassifierMode(env) && isOpenAiApiKeyConfigured();
}

async function createModelSignedUrl(
  bucket: string,
  path: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .storage.from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function persistHliClassificationLedger(input: {
  sourceUploadId: string;
  tenantId: string | null;
  storageBucket: string;
  storagePath: string;
  classifierVersion: string;
  result: Awaited<ReturnType<typeof classifyWithHli>>["result"];
}): Promise<void> {
  try {
    await insertHliImageClassificationRow(
      classificationResultToHliInsert({
        sourceSystem: "hairaudit",
        sourceRecordId: input.sourceUploadId,
        tenantId: input.tenantId,
        patientId: null,
        caseId: null,
        storageRef: `${input.storageBucket}:${input.storagePath}`,
        clinicalUseContext: "audit",
        result: input.result,
        classifierVersion: input.classifierVersion,
      })
    );
  } catch (e: unknown) {
    console.error("[hairaudit-classifier-live] ledger write failed", {
      source_upload_id: input.sourceUploadId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Live HairAudit classifier — routes through shared HLI OpenAI vision service.
 * Returns null only when not in live mode (caller should use stub/degraded paths).
 */
export async function classifyClinicalHairImageFromModelUrlLive(
  input: ClinicalHairImageClassifierInput & {
    source_upload_id?: string;
    tenant_id?: string | null;
  },
  env: NodeJS.ProcessEnv = process.env
): Promise<ClinicalHairImageClassifierResult | null> {
  if (!isLiveClassifierMode(env)) return null;

  const bucket = input.storage_bucket?.trim();
  const path = input.storage_path?.trim();

  if (!bucket || !path) {
    return buildDegradedHairAuditClassification({
      canonical_photo_category: input.canonical_photo_category,
      legacy_upload_type: input.legacy_upload_type,
      classifier_version: LIVE_CLASSIFIER_VERSION,
      reason: "missing storage reference for live classifier",
    });
  }

  if (!isOpenAiApiKeyConfigured()) {
    return buildDegradedHairAuditClassification({
      canonical_photo_category: input.canonical_photo_category,
      legacy_upload_type: input.legacy_upload_type,
      classifier_version: LIVE_CLASSIFIER_VERSION,
      reason: "OPENAI_API_KEY not configured",
    });
  }

  try {
    const signedUrl = await createModelSignedUrl(bucket, path);
    if (!signedUrl) {
      return buildDegradedHairAuditClassification({
        canonical_photo_category: input.canonical_photo_category,
        legacy_upload_type: input.legacy_upload_type,
        classifier_version: LIVE_CLASSIFIER_VERSION,
        reason: "could not create signed URL for model",
      });
    }

    const { result, classifierVersion } = await classifyWithHli({ imageUrlForModel: signedUrl });

    if (input.source_upload_id?.trim()) {
      void persistHliClassificationLedger({
        sourceUploadId: input.source_upload_id.trim(),
        tenantId: input.tenant_id ?? null,
        storageBucket: bucket,
        storagePath: path,
        classifierVersion,
        result,
      });
    }

    return buildHairAuditClassificationFromHli({
      hliCategory: result.category,
      categoryConfidence: result.categoryConfidence,
      classifierVersion,
      notes: result.notes,
      fallbackExternalCategory: input.canonical_photo_category,
    });
  } catch (e: unknown) {
    return buildDegradedHairAuditClassification({
      canonical_photo_category: input.canonical_photo_category,
      legacy_upload_type: input.legacy_upload_type,
      classifier_version: LIVE_CLASSIFIER_VERSION,
      reason: e instanceof Error ? e.message : "live classifier failed",
    });
  }
}