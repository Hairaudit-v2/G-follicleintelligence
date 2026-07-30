/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Signed callbacks to HairAudit.
 *
 * Contract note: HairAudit callback requires `projectionId` (HairAudit row id) and
 * `providerResponseId`. The current ImagingOS request body does NOT send projectionId.
 * FiOS accepts optional `projectionId` / `externalProjectionId` / X-HairAudit-Projection-Id.
 * Without it, sync responses work; async callbacks are skipped with a terminal audit event.
 */

import "server-only";

import {
  DEFAULT_CALLBACK_MAX_ATTEMPTS,
  resolveProjectionGatewayConfig,
  type ProjectionGatewayConfig,
} from "./config.server";
import { signHairAuditProjectionCallback } from "./hmac";
import { logProjectionEvent } from "./observability";
import type { ProjectionJobRecord } from "./types";

export type CallbackPayload = {
  caseId: string;
  projectionId: string;
  providerResponseId: string;
  status: "completed" | "failed";
  outputStorageRef?: string;
  outputChecksum?: string;
  errorCode?: string;
  message?: string;
};

export type CallbackDeliveryResult =
  | { ok: true; attempts: number }
  | { ok: false; attempts: number; lastStatus?: number; reason: string };

export function buildHairAuditCallbackUrl(args: {
  callbackBaseUrl: string;
  caseId: string;
}): string {
  // Trusted config only — never accept callback host from the request body.
  return `${args.callbackBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(args.caseId)}/pre-surgery-intelligence/projection/callback`;
}

export async function deliverHairAuditProjectionCallback(input: {
  job: ProjectionJobRecord;
  status: "completed" | "failed";
  config?: ProjectionGatewayConfig;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
}): Promise<CallbackDeliveryResult> {
  const config = input.config ?? resolveProjectionGatewayConfig();
  const sleep = input.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const fetchImpl = input.fetchImpl ?? fetch;
  const maxAttempts = input.maxAttempts ?? DEFAULT_CALLBACK_MAX_ATTEMPTS;

  const projectionId = input.job.externalProjectionId;
  const providerResponseId = input.job.providerResponseId;
  if (!projectionId || !providerResponseId) {
    logProjectionEvent({
      event: "callback_failed",
      jobId: input.job.id,
      externalCaseId: input.job.externalCaseId ?? input.job.caseId,
      reason: "missing_projection_id_contract",
    });
    return {
      ok: false,
      attempts: 0,
      reason:
        "HairAudit projectionId was not supplied on the request; async callback cannot be delivered. Sync responses remain supported.",
    };
  }
  if (!config.callbackBaseUrl || !config.callbackSigningSecret) {
    logProjectionEvent({
      event: "callback_failed",
      jobId: input.job.id,
      reason: "callback_not_configured",
    });
    return { ok: false, attempts: 0, reason: "callback_not_configured" };
  }

  const caseId = input.job.externalCaseId ?? input.job.caseId;
  const payload: CallbackPayload = {
    caseId,
    projectionId,
    providerResponseId,
    status: input.status,
    ...(input.status === "completed"
      ? {
          outputStorageRef: input.job.outputStorageRef ?? undefined,
          outputChecksum: input.job.outputChecksum ?? undefined,
        }
      : {
          errorCode: input.job.errorCode ?? "provider_failed",
          message: input.job.errorMessageSafe ?? "Projection failed",
        }),
  };

  const rawBody = JSON.stringify(payload);
  const url = buildHairAuditCallbackUrl({
    callbackBaseUrl: config.callbackBaseUrl,
    caseId,
  });

  let lastStatus: number | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signHairAuditProjectionCallback({
      timestamp,
      rawBody,
      secret: config.callbackSigningSecret,
    });
    logProjectionEvent({
      event: "callback_attempted",
      jobId: input.job.id,
      externalCaseId: caseId,
      attempt,
    });
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hairaudit-timestamp": timestamp,
          "x-hairaudit-signature": signature,
        },
        body: rawBody,
      });
      lastStatus = res.status;
      if (res.ok || res.status === 409) {
        // 409 replay = already delivered — treat as idempotent success.
        logProjectionEvent({
          event: "callback_succeeded",
          jobId: input.job.id,
          externalCaseId: caseId,
          attempt,
          httpStatus: res.status,
        });
        return { ok: true, attempts: attempt };
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        logProjectionEvent({
          event: "callback_failed",
          jobId: input.job.id,
          externalCaseId: caseId,
          attempt,
          httpStatus: res.status,
          reason: "permanent",
        });
        return { ok: false, attempts: attempt, lastStatus, reason: `http_${res.status}` };
      }
    } catch (e) {
      logProjectionEvent({
        event: "callback_failed",
        jobId: input.job.id,
        externalCaseId: caseId,
        attempt,
        reason: e instanceof Error ? e.message : "network_error",
      });
    }
    if (attempt < maxAttempts) await sleep(100 * 2 ** attempt);
  }

  return {
    ok: false,
    attempts: maxAttempts,
    lastStatus,
    reason: "exhausted_retries",
  };
}
