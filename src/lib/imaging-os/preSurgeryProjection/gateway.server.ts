/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — HairAudit gateway orchestration.
 */

import "server-only";

import {
  HDR_HA_PROJECTION_ID,
  resolveProjectionGatewayConfig,
  type ProjectionGatewayConfig,
} from "./config.server";
import { authorizeHairAuditProjectionRequest } from "./auth";
import { deliverHairAuditProjectionCallback } from "./callback.server";
import {
  clinicianReviewStateAfterCompletion,
  patientVisibilityAfterCompletion,
  assertTransition,
} from "./domain.server";
import { ProjectionGatewayError, errorJson } from "./errors";
import { sha256Hex } from "./hmac";
import {
  assertNotConflict,
  resolveProjectionIdempotency,
} from "./idempotency.server";
import {
  createMemoryJobStore,
  createSupabaseJobStore,
  type ProjectionJobStore,
} from "./jobs.server";
import { logProjectionEvent } from "./observability";
import { resolveProjectionProvider } from "./providerRegistry.server";
import {
  assertProjectionRequestNotReplayed,
  createMemoryReplayStore,
  createSupabaseReplayStore,
  type ProjectionReplayStore,
} from "./replayProtection.server";
import { MAX_PROJECTION_REQUEST_BYTES, parseHairAuditProjectionRequest } from "./schema";
import {
  createMemoryProjectionStorage,
  createSupabaseProjectionStorage,
  validateProjectionOutputBytes,
  type ProjectionStorage,
} from "./storage.server";
import { resolveHairAuditTenantProvenance } from "./tenantMapping.server";
import type { ProjectionHealthResponse, ProjectionSuccessResponse } from "./types";
import { reportProviderState } from "./config.server";

export const HAIRAUDIT_SERVICE_SOURCE = "hairaudit" as const;

export type ProjectionGatewayDeps = {
  config?: ProjectionGatewayConfig;
  jobStore?: ProjectionJobStore;
  replayStore?: ProjectionReplayStore;
  storage?: ProjectionStorage;
  fetchImpl?: typeof fetch;
  nowMs?: number;
  /** When true, use memory stores (unit tests). */
  useMemory?: boolean;
};

function pickStores(deps: ProjectionGatewayDeps, config: ProjectionGatewayConfig) {
  const useMemory = deps.useMemory === true || !config.supabaseConfigured;
  return {
    jobStore:
      deps.jobStore ?? (useMemory ? createMemoryJobStore() : createSupabaseJobStore()),
    replayStore:
      deps.replayStore ??
      (useMemory ? createMemoryReplayStore() : createSupabaseReplayStore()),
    storage:
      deps.storage ??
      (useMemory ? createMemoryProjectionStorage() : createSupabaseProjectionStorage()),
  };
}

export function buildProjectionHealth(
  config: ProjectionGatewayConfig = resolveProjectionGatewayConfig()
): ProjectionHealthResponse {
  const providerState = reportProviderState(config);
  const generationEnabled =
    config.enabled &&
    config.provider !== "disabled" &&
    providerState !== "PROVIDER_DISABLED";
  const storageConfigured = config.supabaseConfigured || process.env.NODE_ENV !== "production";
  const callbackConfigured = Boolean(
    config.callbackBaseUrl && config.callbackSigningSecret
  );
  const providerConfigured = Boolean(config.serviceToken) && generationEnabled;

  let status: ProjectionHealthResponse["status"] = "healthy";
  if (!config.enabled || providerState === "PROVIDER_DISABLED") status = "disabled";
  else if (providerState === "STUB_ONLY_NON_PRODUCTION") status = "degraded";
  else if (!storageConfigured || (config.hairauditEnabled && !callbackConfigured)) {
    status = "degraded";
  }

  return {
    status,
    provider: config.provider,
    providerConfigured,
    generationEnabled,
    storageConfigured,
    callbackConfigured,
    providerState,
    hairauditChannelEnabled: config.enabled && config.hairauditEnabled,
    clinicChannelEnabled: config.enabled && config.clinicEnabled,
    patientSharingEnabled: config.enabled && config.patientSharingEnabled,
  };
}

export type HairAuditProjectionGatewayResult =
  | { httpStatus: 200; body: ProjectionSuccessResponse }
  | { httpStatus: number; body: Record<string, unknown> };

export async function handleHairAuditProjectionRequest(input: {
  req: Request;
  rawBody: string;
  deps?: ProjectionGatewayDeps;
}): Promise<HairAuditProjectionGatewayResult> {
  const deps = input.deps ?? {};
  const env = process.env;
  const config = deps.config ?? resolveProjectionGatewayConfig(env);
  const nowMs = deps.nowMs ?? Date.now();
  const stores = pickStores(deps, config);

  logProjectionEvent({ event: "request_received" });

  try {
    if (Buffer.byteLength(input.rawBody, "utf8") > MAX_PROJECTION_REQUEST_BYTES) {
      throw new ProjectionGatewayError("request_too_large", "Request body exceeds size limit", 413);
    }

    if (!config.enabled || !config.hairauditEnabled) {
      throw new ProjectionGatewayError(
        config.enabled ? "hairaudit_channel_disabled" : "feature_disabled",
        config.enabled
          ? "HairAudit projection channel is disabled"
          : "Pre-surgery projection gateway is disabled",
        503
      );
    }

    let json: unknown;
    try {
      json = input.rawBody ? JSON.parse(input.rawBody) : {};
    } catch {
      throw new ProjectionGatewayError("invalid_json", "Request body must be JSON", 400);
    }

    const parsed = parseHairAuditProjectionRequest(json);
    if (!parsed.ok) {
      logProjectionEvent({
        event: "validation_failed",
        reason: parsed.code,
        httpStatus: 400,
      });
      throw new ProjectionGatewayError(
        parsed.code as never,
        parsed.message,
        400,
        parsed.details
      );
    }
    const body = parsed.data;

    const auth = authorizeHairAuditProjectionRequest({
      req: input.req,
      rawBody: input.rawBody,
      caseIdFromBody: body.caseId,
      env,
      nowMs,
      config,
    });

    const headerProjectionId = input.req.headers.get(HDR_HA_PROJECTION_ID)?.trim() || null;
    const externalProjectionId =
      body.projectionId?.trim() ||
      body.externalProjectionId?.trim() ||
      headerProjectionId;

    // Prefer header idempotency key; body may be null from HairAudit adapter.
    const idempotencyKey = auth.idempotencyKey;
    const inputChecksum =
      body.inputChecksum?.trim() ||
      sha256Hex(
        `${body.caseId}:${body.sourceImageId}:${body.mode}:${body.approvedGraftPlanChecksum}`
      );
    const requestPayloadChecksum = sha256Hex(input.rawBody);

    // Idempotency before replay: same-second HairAudit retries share signature material;
    // completed jobs must short-circuit without treating the retry as a hostile replay.
    const idem = await resolveProjectionIdempotency({
      store: stores.jobStore,
      serviceSource: HAIRAUDIT_SERVICE_SOURCE,
      caseId: body.caseId,
      idempotencyKey,
      requestPayloadChecksum,
    });
    assertNotConflict(idem);
    if (idem.kind === "hit" && idem.response) {
      return { httpStatus: 200, body: idem.response };
    }
    if (idem.kind === "hit" && idem.job.status === "failed") {
      return {
        httpStatus: 422,
        body: errorJson(
          new ProjectionGatewayError(
            "provider_failed",
            idem.job.errorMessageSafe ?? "Prior job failed",
            422
          ),
          idem.job.id
        ),
      };
    }

    await assertProjectionRequestNotReplayed({
      store: stores.replayStore,
      serviceSource: HAIRAUDIT_SERVICE_SOURCE,
      timestamp: auth.timestamp,
      idempotencyKey: auth.idempotencyKey,
      rawBody: input.rawBody,
    });

    const provenance = resolveHairAuditTenantProvenance({
      externalCaseId: body.caseId,
      externalProjectionId,
      config,
    });

    const provider = resolveProjectionProvider(config);

    let job =
      idem.kind === "hit"
        ? idem.job
        : await stores.jobStore.insert({
            sourceChannel: "hairaudit_service",
            serviceSource: HAIRAUDIT_SERVICE_SOURCE,
            tenantId: provenance.tenantId,
            clinicId: provenance.clinicId,
            caseId: body.caseId,
            externalCaseId: body.caseId,
            externalProjectionId,
            patientId: null,
            procedureId: null,
            idempotencyKey,
            inputChecksum,
            schemaVersion: body.schemaVersion,
            mode: body.mode,
            modelVersion: body.modelVersion,
            requestPayloadChecksum,
            providerName: provider.name,
            immutableSnapshot: (body.canonical as unknown as Record<string, unknown>) ?? {
              caseId: body.caseId,
              sourceImageId: body.sourceImageId,
              approvedGraftPlanId: body.approvedGraftPlanId,
              approvedGraftPlanVersion: body.approvedGraftPlanVersion,
              approvedGraftPlanChecksum: body.approvedGraftPlanChecksum,
              mode: body.mode,
            },
          });

    assertTransition(job.status, "validated");
    job = await stores.jobStore.update(job.id, { status: "validated" });
    assertTransition(job.status, "queued");
    job = await stores.jobStore.update(job.id, { status: "queued" });
    logProjectionEvent({
      event: "queued",
      jobId: job.id,
      externalCaseId: body.caseId,
      tenantId: provenance.tenantId,
      clinicId: provenance.clinicId,
      sourceChannel: "hairaudit_service",
      provider: provider.name,
    });

    assertTransition(job.status, "generating");
    job = await stores.jobStore.update(job.id, {
      status: "generating",
      attemptCount: job.attemptCount + 1,
    });
    logProjectionEvent({
      event: "provider_started",
      jobId: job.id,
      provider: provider.name,
      externalCaseId: body.caseId,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.syncBudgetMs);
    let generateResult;
    try {
      generateResult = await provider.generateProjection({
        jobId: job.id,
        mode: body.mode,
        modelVersion: body.modelVersion,
        caseId: body.caseId,
        sourceImageId: body.sourceImageId,
        sourceImageRef: body.sourceImageRef,
        approvedGraftPlanId: body.approvedGraftPlanId,
        approvedGraftPlanVersion: body.approvedGraftPlanVersion,
        approvedGraftPlanChecksum: body.approvedGraftPlanChecksum,
        approvedAnnotationIds: body.approvedAnnotationIds,
        constraints: body.constraints,
        deterministicSeed: body.deterministicSeed,
        canonical: body.canonical,
        inputChecksum,
        abortSignal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!generateResult.ok) {
      logProjectionEvent({
        event: "provider_failed",
        jobId: job.id,
        reason: generateResult.errorCode,
        externalCaseId: body.caseId,
      });
      job = await stores.jobStore.update(job.id, {
        status: generateResult.errorCode === "provider_cancelled" ? "timed_out" : "failed",
        errorCode: generateResult.errorCode,
        errorMessageSafe: generateResult.message,
        providerRequestId: generateResult.providerRequestId ?? null,
        providerResponseId: generateResult.providerResponseId ?? null,
        completedAt: new Date().toISOString(),
      });
      logProjectionEvent({
        event: "terminal_job_failure",
        jobId: job.id,
        status: job.status,
        reason: generateResult.errorCode,
      });
      if (externalProjectionId) {
        await deliverHairAuditProjectionCallback({
          job,
          status: "failed",
          config,
          fetchImpl: deps.fetchImpl,
        });
      }
      return {
        httpStatus: generateResult.retryable ? 503 : 422,
        body: {
          ok: false,
          error: generateResult.errorCode,
          message: generateResult.message,
          errorCode: generateResult.errorCode,
          request_id: generateResult.providerRequestId,
          response_id: generateResult.providerResponseId,
        },
      };
    }

    logProjectionEvent({
      event: "provider_completed",
      jobId: job.id,
      provider: provider.name,
      externalCaseId: body.caseId,
    });

    // Never advertise stub output as a real model.
    const limitations =
      provider.name === "stub"
        ? generateResult.limitations
        : generateResult.limitations;

    const validated = await validateProjectionOutputBytes({
      bytes: generateResult.outputBytes,
      mimeType: generateResult.mimeType,
      jobId: job.id,
      caseId: body.caseId,
    });

    const stored = await stores.storage.store({
      tenantId: provenance.tenantId,
      caseId: body.caseId,
      jobId: job.id,
      validated,
    });

    job = await stores.jobStore.update(job.id, {
      status: "completed",
      providerRequestId: generateResult.providerRequestId,
      providerResponseId: generateResult.providerResponseId,
      outputStorageRef: stored.outputStorageRef,
      outputChecksum: stored.outputChecksum,
      clinicianReviewState: clinicianReviewStateAfterCompletion(),
      patientVisibilityEligibility: patientVisibilityAfterCompletion(),
      completedAt: new Date().toISOString(),
      externalProjectionId: externalProjectionId,
    });

    if (externalProjectionId) {
      // Fire-and-forget style but awaited for determinism in tests; failures are logged.
      await deliverHairAuditProjectionCallback({
        job,
        status: "completed",
        config,
        fetchImpl: deps.fetchImpl,
      });
    }

    const response: ProjectionSuccessResponse = {
      outputStorageRef: stored.outputStorageRef,
      outputChecksum: stored.outputChecksum,
      providerRequestId: generateResult.providerRequestId,
      providerResponseId: generateResult.providerResponseId,
      modelVersion: generateResult.modelVersion,
      limitations,
      planningAssumptions: generateResult.planningAssumptions,
    };
    return { httpStatus: 200, body: response };
  } catch (e) {
    if (e instanceof ProjectionGatewayError) {
      return { httpStatus: e.httpStatus, body: errorJson(e) };
    }
    logProjectionEvent({
      event: "terminal_job_failure",
      reason: e instanceof Error ? e.message : "unknown",
      httpStatus: 500,
    });
    return {
      httpStatus: 500,
      body: {
        ok: false,
        error: "internal_error",
        message: "Projection gateway internal error",
        errorCode: "internal_error",
      },
    };
  }
}
