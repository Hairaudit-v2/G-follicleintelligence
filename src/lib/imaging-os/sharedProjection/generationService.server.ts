/**
 * Shared projection service façade (1C).
 * Owns technical lifecycle, transactional idempotency, provider invocation, product refs.
 * Clinical approval and patient sharing remain product-owned.
 */

import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
  SHARED_PROJECTION_RESPONSE_CONTRACT_VERSION,
  assertProviderMayEmitArtifact,
  deriveSharedProjectionIdempotencyKey,
  patientSafeFailureMessage,
  type SharedProjectionFailureCategory,
  type SharedProjectionIdempotencyParts,
  type SharedProjectionLifecycleState,
  type SharedProjectionRequestV1,
  type SharedProjectionRequestingProduct,
  type SharedProjectionResponseV1,
  type SharedTechnicalValidationResults,
} from "@follicle/projection-core/server";
import {
  assertProviderConfigAllowsGeneration,
  estimateSharedProjectionCostUsd,
  resolveSharedProjectionProviderConfig,
  type SharedProjectionProviderConfig,
} from "./providerConfig";
import type { PilotPreflightRecord } from "./pilotTypes";
import {
  buildOpenAiProjectedOutcomeStoragePath,
  buildRecipientEditMask,
  createBoundSharedOpenAiProvider,
  createSharedProjectionStorageDeps,
} from "./openai";

export type { PilotPreflightRecord };

export type SharedGenerationRecord = {
  id: string;
  lifecycleStatus: SharedProjectionLifecycleState;
  idempotencyKey: string;
  providerId: string;
  artifactType: string;
  outputStorageRef: string | null;
  outputChecksum: string | null;
  technicalValidation: SharedTechnicalValidationResults | null;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  latencyMs: number | null;
};

export async function findGenerationByIdempotency(input: {
  tenantId: string;
  idempotencyKey: string;
}): Promise<SharedGenerationRecord | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("imaging_os_projection_generations")
    .select(
      "id, lifecycle_status, idempotency_key, provider_id, artifact_type, output_storage_ref, output_checksum, technical_validation, immutable_request_snapshot"
    )
    .eq("tenant_id", input.tenantId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (error) {
    if (/does not exist|relation/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const snap = (data.immutable_request_snapshot ?? {}) as Record<string, unknown>;
  return mapGenerationRow(data, snap);
}

function mapGenerationRow(
  data: Record<string, unknown>,
  snap: Record<string, unknown> = {}
): SharedGenerationRecord {
  return {
    id: String(data.id),
    lifecycleStatus: data.lifecycle_status as SharedProjectionLifecycleState,
    idempotencyKey: String(data.idempotency_key),
    providerId: String(data.provider_id),
    artifactType: String(data.artifact_type),
    outputStorageRef:
      data.output_storage_ref != null ? String(data.output_storage_ref) : null,
    outputChecksum: data.output_checksum != null ? String(data.output_checksum) : null,
    technicalValidation:
      (data.technical_validation as SharedTechnicalValidationResults | null) ?? null,
    estimatedCostUsd:
      typeof snap.estimatedCostUsd === "number" ? snap.estimatedCostUsd : null,
    actualCostUsd: typeof snap.actualCostUsd === "number" ? snap.actualCostUsd : null,
    latencyMs: typeof snap.latencyMs === "number" ? snap.latencyMs : null,
  };
}

export async function attachProductConsumer(input: {
  sharedGenerationId: string;
  product: SharedProjectionRequestingProduct;
  localCaseId: string;
}): Promise<void> {
  const db = supabaseAdmin();
  await db.from("imaging_os_projection_product_refs").upsert(
    {
      shared_generation_id: input.sharedGenerationId,
      product: input.product,
      local_case_id: input.localCaseId,
      authorised_consumer: true,
      patient_sharing_decision: "unavailable",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shared_generation_id,product,local_case_id" }
  );
}

export type RequestSharedIllustrativeGenerationInput = {
  tenantId: string;
  patientSubjectRef: string;
  fiosCaseId: string | null;
  hairauditCaseRef: string | null;
  surgicalPlanId: string;
  surgicalPlanVersion: number;
  hairlineDesignId: string;
  hairlineDesignVersion: number;
  sourceImageRef: string;
  sourceImageChecksum: string;
  sourceView: SharedProjectionIdempotencyParts["view"];
  treatmentMaskRef?: string | null;
  treatmentMaskChecksum: string;
  preservationMaskRef?: string | null;
  preservationMaskChecksum?: string | null;
  projectionMode: SharedProjectionIdempotencyParts["mode"];
  providerId: string;
  modelVersion: string;
  promptTemplateVersion: string;
  requestingProduct: SharedProjectionRequestingProduct;
  requestingUserId?: string | null;
  requestingCapability?: string | null;
  correlationId: string;
  planApproved: boolean;
  hairlineApproved: boolean;
  /** Current approved versions — reject stale. */
  currentApprovedPlanVersion?: number;
  currentApprovedHairlineVersion?: number;
  zones?: Array<{
    key: string;
    grafts?: number | null;
    deferred?: boolean | null;
    polygonNorm?: Array<{ x: number; y: number }> | null;
  }>;
  hairlineCurveNorm?: Array<{ x: number; y: number }> | null;
  graftAllocationsByZone?: SharedProjectionRequestV1["graftAllocationsByZone"];
  clinicalAssumptions?: Record<string, unknown>;
  /** When false, stop after preflight (READY FOR CONTROLLED PILOT). */
  confirmPaidGeneration?: boolean;
  /** Force new attempt (correction / regenerate) — new idempotency namespace. */
  correctionAttemptToken?: string | null;
  /** Injected for tests */
  config?: SharedProjectionProviderConfig;
  loadSourceBytes?: (ref: string) => Promise<Uint8Array>;
  storeBytes?: (path: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  providerOverride?: ReturnType<typeof createBoundSharedOpenAiProvider>["provider"];
};

export type RequestSharedIllustrativeGenerationResult =
  | {
      ok: true;
      kind: "idempotent_hit" | "generated" | "ready_for_controlled_pilot";
      generation?: SharedGenerationRecord;
      response?: SharedProjectionResponseV1;
      preflight: PilotPreflightRecord;
      providerInvocationCount: number;
    }
  | {
      ok: false;
      code: string;
      message: string;
      failureCategory: SharedProjectionFailureCategory;
      lifecycleHint: SharedProjectionLifecycleState;
      preflight?: PilotPreflightRecord;
    };

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Full shared illustrative generation path with transactional idempotency.
 */
export async function requestSharedIllustrativeGeneration(
  input: RequestSharedIllustrativeGenerationInput
): Promise<RequestSharedIllustrativeGenerationResult> {
  assertProviderMayEmitArtifact({
    providerId: input.providerId,
    artifactType: "illustrative_projected_outcome",
  });

  const config = input.config ?? resolveSharedProjectionProviderConfig();
  const estimatedCostUsd = estimateSharedProjectionCostUsd({ quality: config.outputQuality });
  const graftTotal =
    input.graftAllocationsByZone?.reduce((s, z) => s + (z.grafts || 0), 0) ??
    input.zones?.reduce((s, z) => s + (typeof z.grafts === "number" ? z.grafts : 0), 0) ??
    0;

  const preflight: PilotPreflightRecord = {
    tenantId: input.tenantId,
    caseId: input.fiosCaseId ?? input.hairauditCaseRef,
    planId: input.surgicalPlanId,
    planVersion: input.surgicalPlanVersion,
    hairlineId: input.hairlineDesignId,
    hairlineVersion: input.hairlineDesignVersion,
    sourceImageRef: input.sourceImageRef,
    treatmentMaskChecksum: input.treatmentMaskChecksum,
    graftTotal,
    assumptions: [
      `mode=${input.projectionMode}`,
      `view=${input.sourceView}`,
      `graftTotal=${graftTotal}`,
      `provider=${input.providerId}`,
      `model=${input.modelVersion || config.model}`,
      `prompt=${input.promptTemplateVersion || config.promptTemplateVersion}`,
    ],
    estimatedCostUsd,
    providerId: config.providerId,
    modelVersion: input.modelVersion || config.model,
    view: input.sourceView,
    mode: input.projectionMode,
    dpiaStatus: config.dpiaStatus,
  };

  if (!input.planApproved) {
    return fail("prerequisites_incomplete", "awaiting_plan_approval", preflight);
  }
  if (!input.hairlineApproved) {
    return fail("prerequisites_incomplete", "awaiting_hairline_approval", preflight);
  }

  if (
    input.currentApprovedPlanVersion != null &&
    input.currentApprovedPlanVersion !== input.surgicalPlanVersion
  ) {
    return fail("unsupported_request", "ready_to_generate", preflight, "stale_plan");
  }
  if (
    input.currentApprovedHairlineVersion != null &&
    input.currentApprovedHairlineVersion !== input.hairlineDesignVersion
  ) {
    return fail("unsupported_request", "ready_to_generate", preflight, "stale_hairline");
  }

  if (input.sourceView !== "frontal") {
    return fail("unsupported_request", "ready_to_generate", preflight, "non_frontal_view");
  }
  if (input.projectionMode !== "planned") {
    return fail("unsupported_request", "ready_to_generate", preflight, "mode_not_planned");
  }

  const gate = assertProviderConfigAllowsGeneration(config, {
    tenantId: input.tenantId,
    estimatedCostUsd,
  });
  if (!gate.ok) {
    return {
      ok: false,
      code: gate.code,
      message: gate.message,
      failureCategory:
        gate.code.includes("dpia") || gate.code.includes("allowlist") || gate.code.includes("tenant")
          ? gate.code.includes("tenant")
            ? "tenant_denied"
            : "provider_disabled"
          : "provider_disabled",
      lifecycleHint: "ready_to_generate",
      preflight,
    };
  }

  const modelVersion = input.modelVersion || config.model;
  const promptTemplateVersion = input.promptTemplateVersion || config.promptTemplateVersion;

  const parts: SharedProjectionIdempotencyParts = {
    patientSubjectRef: input.patientSubjectRef,
    planId: input.surgicalPlanId,
    planVersion: input.surgicalPlanVersion,
    hairlineDesignId: input.hairlineDesignId,
    hairlineDesignVersion: input.hairlineDesignVersion,
    sourceImageChecksum: input.sourceImageChecksum,
    maskChecksum: input.treatmentMaskChecksum,
    view: input.sourceView,
    mode: input.projectionMode,
    providerId: input.providerId || config.providerId,
    modelVersion,
    promptTemplateVersion: input.correctionAttemptToken
      ? `${promptTemplateVersion}#corr=${input.correctionAttemptToken}`
      : promptTemplateVersion,
  };
  const idempotencyKey = deriveSharedProjectionIdempotencyKey(parts);

  const existing = await findGenerationByIdempotency({
    tenantId: input.tenantId,
    idempotencyKey,
  });
  if (existing) {
    await attachIfNeeded(input, existing.id);
    await recordUsageEvent({
      tenantId: input.tenantId,
      sharedGenerationId: existing.id,
      providerId: existing.providerId,
      modelVersion,
      requestingProduct: input.requestingProduct,
      eventKind: "idempotent_hit",
      estimatedCostUsd: 0,
      metadata: { note: "no_additional_provider_charge" },
    });
    return {
      ok: true,
      kind: "idempotent_hit",
      generation: existing,
      preflight,
      providerInvocationCount: 0,
      response: successResponseFromGeneration(existing, input, modelVersion, promptTemplateVersion),
    };
  }

  if (input.confirmPaidGeneration !== true) {
    return {
      ok: true,
      kind: "ready_for_controlled_pilot",
      preflight,
      providerInvocationCount: 0,
    };
  }

  const bound = createBoundSharedOpenAiProvider({ config });
  const provider = input.providerOverride ?? bound.provider;
  if (!provider) {
    return {
      ok: false,
      code: config.configurationError ?? "provider_disabled",
      message: PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE,
      failureCategory: "provider_disabled",
      lifecycleHint: "ready_to_generate",
      preflight,
    };
  }

  const db = supabaseAdmin();
  const claimId = randomUUID();
  const claimSnapshot = {
    ...parts,
    estimatedCostUsd,
    requestingProduct: input.requestingProduct,
    correlationId: input.correlationId,
  };

  const { data: claimed, error: claimError } = await db
    .from("imaging_os_projection_generations")
    .insert({
      id: claimId,
      tenant_id: input.tenantId,
      patient_subject_ref: input.patientSubjectRef,
      fios_case_id: input.fiosCaseId,
      hairaudit_case_ref: input.hairauditCaseRef,
      artifact_type: "illustrative_projected_outcome",
      lifecycle_status: "generation_requested",
      surgical_plan_id: input.surgicalPlanId,
      surgical_plan_version: input.surgicalPlanVersion,
      hairline_design_id: input.hairlineDesignId,
      hairline_design_version: input.hairlineDesignVersion,
      source_image_ref: input.sourceImageRef,
      source_image_checksum: input.sourceImageChecksum,
      source_view: input.sourceView,
      treatment_mask_ref: input.treatmentMaskRef ?? null,
      treatment_mask_checksum: input.treatmentMaskChecksum,
      preservation_mask_ref: input.preservationMaskRef ?? null,
      preservation_mask_checksum: input.preservationMaskChecksum ?? null,
      projection_mode: input.projectionMode,
      provider_id: config.providerId,
      model_version: modelVersion,
      prompt_template_version: promptTemplateVersion,
      idempotency_key: idempotencyKey,
      correlation_id: input.correlationId,
      requesting_product: input.requestingProduct,
      immutable_request_snapshot: claimSnapshot,
    })
    .select(
      "id, lifecycle_status, idempotency_key, provider_id, artifact_type, output_storage_ref, output_checksum, technical_validation, immutable_request_snapshot"
    )
    .maybeSingle();

  if (claimError) {
    // Concurrent claim — second caller attaches as consumer.
    if (/duplicate|unique|conflict/i.test(claimError.message)) {
      const winner = await findGenerationByIdempotency({
        tenantId: input.tenantId,
        idempotencyKey,
      });
      if (winner) {
        await attachIfNeeded(input, winner.id);
        await recordUsageEvent({
          tenantId: input.tenantId,
          sharedGenerationId: winner.id,
          providerId: winner.providerId,
          modelVersion,
          requestingProduct: input.requestingProduct,
          eventKind: "idempotent_hit",
          estimatedCostUsd: 0,
          metadata: { note: "concurrent_claim_lost_no_provider_charge" },
        });
        return {
          ok: true,
          kind: "idempotent_hit",
          generation: winner,
          preflight,
          providerInvocationCount: 0,
          response: successResponseFromGeneration(
            winner,
            input,
            modelVersion,
            promptTemplateVersion
          ),
        };
      }
    }
    return {
      ok: false,
      code: "implementation_failure",
      message: patientSafeFailureMessage("implementation_failure"),
      failureCategory: "implementation_failure",
      lifecycleHint: "provider_failed",
      preflight,
    };
  }

  const generationId = String(claimed?.id ?? claimId);
  await attachIfNeeded(input, generationId);
  await recordUsageEvent({
    tenantId: input.tenantId,
    sharedGenerationId: generationId,
    providerId: config.providerId,
    modelVersion,
    requestingProduct: input.requestingProduct,
    eventKind: "generation_attempt",
    estimatedCostUsd,
    metadata: { correlationId: input.correlationId },
  });

  await db
    .from("imaging_os_projection_generations")
    .update({ lifecycle_status: "processing", updated_at: new Date().toISOString() })
    .eq("id", generationId);

  const storage =
    input.loadSourceBytes && input.storeBytes
      ? { loadBytes: input.loadSourceBytes, storeBytes: input.storeBytes }
      : createSharedProjectionStorageDeps(db);

  // Ensure masks exist — build from zones when refs not supplied.
  let treatmentMaskRef = input.treatmentMaskRef ?? null;
  let treatmentMaskChecksum = input.treatmentMaskChecksum;
  let preservationMaskRef = input.preservationMaskRef ?? null;
  let preservationMaskChecksum = input.preservationMaskChecksum ?? null;

  try {
    const sourceBytes = await storage.loadBytes(input.sourceImageRef);
    const liveChecksum = sha256Hex(sourceBytes);
    if (liveChecksum !== input.sourceImageChecksum) {
      await markFailed(generationId, "unsupported_request", "checksum_mismatch");
      return fail("unsupported_request", "provider_failed", preflight, "checksum_mismatch");
    }

    if (!treatmentMaskRef || !preservationMaskRef) {
      const mask = await buildRecipientEditMask({
        sourceBytes: Buffer.from(sourceBytes),
        zones: input.zones ?? [],
        hairlineCurveNorm: input.hairlineCurveNorm,
      });
      if (mask.hardMaskChecksum !== treatmentMaskChecksum && input.treatmentMaskChecksum) {
        // Caller supplied checksum must match built mask when we construct it.
        if (input.zones && input.zones.length > 0) {
          treatmentMaskChecksum = mask.hardMaskChecksum;
          preflight.treatmentMaskChecksum = treatmentMaskChecksum;
        }
      }
      const maskPath = `shared_projections/${input.tenantId}/${generationId}/masks/treatment_${mask.maskChecksum.slice(0, 16)}.png`;
      const hardPath = `shared_projections/${input.tenantId}/${generationId}/masks/hard_${mask.hardMaskChecksum.slice(0, 16)}.png`;
      await storage.storeBytes(maskPath, mask.maskPng, "image/png");
      await storage.storeBytes(hardPath, mask.hardMaskPng, "image/png");
      treatmentMaskRef = maskPath;
      treatmentMaskChecksum = mask.maskChecksum;
      preservationMaskRef = hardPath;
      preservationMaskChecksum = mask.hardMaskChecksum;
      await db
        .from("imaging_os_projection_generations")
        .update({
          treatment_mask_ref: treatmentMaskRef,
          treatment_mask_checksum: treatmentMaskChecksum,
          preservation_mask_ref: preservationMaskRef,
          preservation_mask_checksum: preservationMaskChecksum,
          updated_at: new Date().toISOString(),
        })
        .eq("id", generationId);
    }

    const request: SharedProjectionRequestV1 = {
      contractVersion: "fi-shared-projection-request-v1",
      tenantId: input.tenantId,
      patientSubjectRef: input.patientSubjectRef,
      fiosCaseId: input.fiosCaseId,
      hairauditCaseRef: input.hairauditCaseRef,
      approvedSurgicalPlanId: input.surgicalPlanId,
      approvedSurgicalPlanVersion: input.surgicalPlanVersion,
      approvedHairlineDesignId: input.hairlineDesignId,
      approvedHairlineDesignVersion: input.hairlineDesignVersion,
      sourceImageRef: input.sourceImageRef,
      sourceImageChecksum: input.sourceImageChecksum,
      sourceView: input.sourceView,
      treatmentMaskRef: treatmentMaskRef!,
      treatmentMaskChecksum,
      preservationMaskRef,
      preservationMaskChecksum: preservationMaskChecksum ?? null,
      graftAllocationsByZone: input.graftAllocationsByZone ?? [],
      recipientSurfaceAreaCm2: null,
      hairCharacteristics: {
        calibreHint: null,
        curlTextureHint: null,
        colourToScalpContrastHint: null,
        hairsPerGraftAssumption: 2.2,
      },
      nativeHairContribution: null,
      projectionMode: input.projectionMode,
      clinicalAssumptions: input.clinicalAssumptions ?? {},
      requestedOutputWidth: config.outputWidth,
      requestedOutputHeight: config.outputHeight,
      requestingProduct: input.requestingProduct,
      requestingUserId: input.requestingUserId ?? null,
      requestingCapability: input.requestingCapability ?? null,
      correlationId: input.correlationId,
      idempotencyKey,
      providerId: config.providerId,
      modelVersion,
      promptTemplateVersion,
      artifactType: "illustrative_projected_outcome",
    };

    const started = Date.now();
    const result = await provider.generate(request, {
      loadSourceBytes: storage.loadBytes,
      loadMaskBytes: storage.loadBytes,
    });
    const latencyMs = Date.now() - started;

    if (!result.ok) {
      await markFailed(generationId, result.failureCategory, result.message);
      await recordUsageEvent({
        tenantId: input.tenantId,
        sharedGenerationId: generationId,
        providerId: config.providerId,
        modelVersion,
        requestingProduct: input.requestingProduct,
        eventKind: "generation_failed",
        estimatedCostUsd,
        metadata: { failureCategory: result.failureCategory, latencyMs },
      });
      return {
        ok: false,
        code: result.failureCategory,
        message: patientSafeFailureMessage(result.failureCategory),
        failureCategory: result.failureCategory,
        lifecycleHint: "provider_failed",
        preflight,
      };
    }

    const outputPath = buildOpenAiProjectedOutcomeStoragePath({
      tenantId: input.tenantId,
      generationId,
      outputChecksum: result.outputChecksum,
    });
    await storage.storeBytes(outputPath, result.outputBytes, result.mimeType);

    const lifecycleStatus: SharedProjectionLifecycleState =
      result.technicalValidation.overallPass
        ? "clinician_review"
        : result.limitations.some((l) => /seam|halo|boundary/i.test(l))
          ? "technical_review_required"
          : "clinician_review";

    const actualCostUsd = estimatedCostUsd;
    const tech = {
      ...result.technicalValidation,
      storageObjectExists: true,
    };

    await db
      .from("imaging_os_projection_generations")
      .update({
        lifecycle_status: lifecycleStatus,
        provider_generation_id: result.providerGenerationId,
        output_storage_ref: outputPath,
        output_checksum: result.outputChecksum,
        mime_type: result.mimeType,
        width_px: result.widthPx,
        height_px: result.heightPx,
        byte_size: result.outputBytes.byteLength,
        technical_validation: tech,
        warnings: result.limitations,
        immutable_request_snapshot: {
          ...claimSnapshot,
          estimatedCostUsd,
          actualCostUsd,
          latencyMs,
          providerCharge: 1,
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", generationId);

    await recordUsageEvent({
      tenantId: input.tenantId,
      sharedGenerationId: generationId,
      providerId: config.providerId,
      modelVersion,
      requestingProduct: input.requestingProduct,
      eventKind: "generation_completed",
      estimatedCostUsd: actualCostUsd,
      metadata: { latencyMs, providerCharge: 1 },
    });

    const generation: SharedGenerationRecord = {
      id: generationId,
      lifecycleStatus,
      idempotencyKey,
      providerId: config.providerId,
      artifactType: "illustrative_projected_outcome",
      outputStorageRef: outputPath,
      outputChecksum: result.outputChecksum,
      technicalValidation: tech,
      estimatedCostUsd,
      actualCostUsd,
      latencyMs,
    };

    return {
      ok: true,
      kind: "generated",
      generation,
      preflight,
      providerInvocationCount: 1,
      response: {
        ok: true,
        contractVersion: SHARED_PROJECTION_RESPONSE_CONTRACT_VERSION,
        sharedGenerationId: generationId,
        lifecycleStatus,
        artifactType: "illustrative_projected_outcome",
        providerId: config.providerId,
        modelVersion,
        providerGenerationId: result.providerGenerationId,
        promptTemplateVersion,
        inputProvenance: {
          surgicalPlanId: input.surgicalPlanId,
          surgicalPlanVersion: input.surgicalPlanVersion,
          hairlineDesignId: input.hairlineDesignId,
          hairlineDesignVersion: input.hairlineDesignVersion,
          sourceImageRef: input.sourceImageRef,
          sourceImageChecksum: input.sourceImageChecksum,
          treatmentMaskChecksum,
          preservationMaskChecksum: preservationMaskChecksum ?? null,
        },
        outputStorageRef: outputPath,
        mimeType: result.mimeType,
        widthPx: result.widthPx,
        heightPx: result.heightPx,
        byteSize: result.outputBytes.byteLength,
        outputChecksum: result.outputChecksum,
        technicalValidation: tech,
        warnings: result.limitations,
        clinicallyApproved: false,
        patientShareable: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generation_failed";
    await markFailed(generationId, "implementation_failure", msg);
    await recordUsageEvent({
      tenantId: input.tenantId,
      sharedGenerationId: generationId,
      providerId: config.providerId,
      modelVersion,
      requestingProduct: input.requestingProduct,
      eventKind: "generation_failed",
      estimatedCostUsd,
      metadata: { error: "implementation_failure" },
    });
    return {
      ok: false,
      code: "implementation_failure",
      message: patientSafeFailureMessage("implementation_failure"),
      failureCategory: "implementation_failure",
      lifecycleHint: "provider_failed",
      preflight,
    };
  }
}

function fail(
  category: SharedProjectionFailureCategory,
  lifecycleHint: SharedProjectionLifecycleState,
  preflight?: PilotPreflightRecord,
  code?: string
): RequestSharedIllustrativeGenerationResult {
  return {
    ok: false,
    code: code ?? category,
    message: patientSafeFailureMessage(category),
    failureCategory: category,
    lifecycleHint,
    preflight,
  };
}

async function attachIfNeeded(
  input: RequestSharedIllustrativeGenerationInput,
  generationId: string
): Promise<void> {
  if (input.fiosCaseId || input.hairauditCaseRef) {
    await attachProductConsumer({
      sharedGenerationId: generationId,
      product: input.requestingProduct,
      localCaseId: input.fiosCaseId ?? input.hairauditCaseRef ?? generationId,
    });
  }
}

async function markFailed(
  generationId: string,
  category: SharedProjectionFailureCategory,
  detail: string
): Promise<void> {
  const db = supabaseAdmin();
  await db
    .from("imaging_os_projection_generations")
    .update({
      lifecycle_status: "provider_failed",
      failure_category: category,
      patient_safe_failure_message: patientSafeFailureMessage(category),
      warnings: [{ code: category, detail: detail.slice(0, 200) }],
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", generationId);
}

async function recordUsageEvent(input: {
  tenantId: string;
  sharedGenerationId: string | null;
  providerId: string;
  modelVersion: string;
  requestingProduct: SharedProjectionRequestingProduct;
  eventKind: "generation_attempt" | "generation_completed" | "generation_failed" | "idempotent_hit";
  estimatedCostUsd?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = supabaseAdmin();
  await db.from("imaging_os_projection_usage_events").insert({
    tenant_id: input.tenantId,
    shared_generation_id: input.sharedGenerationId,
    provider_id: input.providerId,
    model_version: input.modelVersion,
    requesting_product: input.requestingProduct,
    event_kind: input.eventKind,
    estimated_cost_usd: input.estimatedCostUsd ?? null,
    metadata: input.metadata ?? {},
  });
}

function successResponseFromGeneration(
  generation: SharedGenerationRecord,
  input: RequestSharedIllustrativeGenerationInput,
  modelVersion: string,
  promptTemplateVersion: string
): SharedProjectionResponseV1 {
  return {
    ok: true,
    contractVersion: SHARED_PROJECTION_RESPONSE_CONTRACT_VERSION,
    sharedGenerationId: generation.id,
    lifecycleStatus: generation.lifecycleStatus,
    artifactType: "illustrative_projected_outcome",
    providerId: generation.providerId,
    modelVersion,
    providerGenerationId: null,
    promptTemplateVersion,
    inputProvenance: {
      surgicalPlanId: input.surgicalPlanId,
      surgicalPlanVersion: input.surgicalPlanVersion,
      hairlineDesignId: input.hairlineDesignId,
      hairlineDesignVersion: input.hairlineDesignVersion,
      sourceImageRef: input.sourceImageRef,
      sourceImageChecksum: input.sourceImageChecksum,
      treatmentMaskChecksum: input.treatmentMaskChecksum,
      preservationMaskChecksum: input.preservationMaskChecksum ?? null,
    },
    outputStorageRef: generation.outputStorageRef ?? "",
    mimeType: "image/jpeg",
    widthPx: 0,
    heightPx: 0,
    byteSize: 0,
    outputChecksum: generation.outputChecksum ?? "",
    technicalValidation: generation.technicalValidation ?? {
      mimeOk: false,
      dimensionsOk: false,
      byteSizeOk: false,
      storageObjectExists: Boolean(generation.outputStorageRef),
      checksumOk: Boolean(generation.outputChecksum),
      sourceOutcomeAligned: null,
      faceBandMeanDelta: null,
      outOfMaskMeanDelta: null,
      outOfMaskMaxDelta: null,
      outOfMaskChangedFraction: null,
      backgroundBandMeanDelta: null,
      overallPass: false,
    },
    warnings: ["idempotent_hit"],
    clinicallyApproved: false,
    patientShareable: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function setProductLocalReview(input: {
  sharedGenerationId: string;
  product: SharedProjectionRequestingProduct;
  localCaseId: string;
  localReviewStatus:
    | "accepted_for_review"
    | "clinically_accepted"
    | "clinically_rejected"
    | "correction_requested"
    | "excluded_from_report";
  localReviewerId: string;
  note?: string | null;
  correctionRequest?: string | null;
}): Promise<void> {
  const db = supabaseAdmin();
  await db.from("imaging_os_projection_product_refs").upsert(
    {
      shared_generation_id: input.sharedGenerationId,
      product: input.product,
      local_case_id: input.localCaseId,
      local_review_status: input.localReviewStatus,
      local_reviewer_id: input.localReviewerId,
      local_decision_note: input.note ?? null,
      correction_request: input.correctionRequest ?? null,
      patient_sharing_decision: "unavailable",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shared_generation_id,product,local_case_id" }
  );
}

/** Patient sharing remains unavailable through 1C. */
export function patientSharingAvailableInStage1c(): false {
  return false;
}

export function buildSharedProjectionHealth(config = resolveSharedProjectionProviderConfig()) {
  return {
    providerId: config.providerId,
    model: config.model,
    configured: config.apiKeyConfigured,
    enabled: config.enabled,
    mayInvokeProvider: config.mayInvokeProvider,
    realProviderConnected: config.mayInvokeProvider && config.apiKeyConfigured,
    dpiaStatus: config.dpiaStatus,
    configurationError: config.configurationError,
    patientSharingAvailable: false as const,
  };
}
