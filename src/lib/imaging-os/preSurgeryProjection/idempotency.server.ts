/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Deterministic idempotency helpers.
 */

import { ProjectionGatewayError } from "./errors";
import { logProjectionEvent } from "./observability";
import type { ProjectionJobRecord } from "./types";
import { TERMINAL_JOB_STATUSES, type ProjectionJobStore } from "./jobs.server";
import type { ProjectionSuccessResponse } from "./types";

export type IdempotencyResolution =
  | { kind: "miss" }
  | { kind: "hit"; job: ProjectionJobRecord; response?: ProjectionSuccessResponse }
  | { kind: "conflict"; job: ProjectionJobRecord };

export async function resolveProjectionIdempotency(input: {
  store: ProjectionJobStore;
  serviceSource: string;
  caseId: string;
  idempotencyKey: string;
  requestPayloadChecksum: string;
}): Promise<IdempotencyResolution> {
  const existing = await input.store.findByIdempotency({
    serviceSource: input.serviceSource,
    caseId: input.caseId,
    idempotencyKey: input.idempotencyKey,
  });
  if (!existing) return { kind: "miss" };

  if (existing.requestPayloadChecksum !== input.requestPayloadChecksum) {
    logProjectionEvent({
      event: "idempotency_conflict",
      jobId: existing.id,
      externalCaseId: input.caseId,
      httpStatus: 409,
      idempotencyKeyPrefix: input.idempotencyKey,
    });
    return { kind: "conflict", job: existing };
  }

  logProjectionEvent({
    event: "idempotency_hit",
    jobId: existing.id,
    externalCaseId: input.caseId,
    status: existing.status,
    idempotencyKeyPrefix: input.idempotencyKey,
  });

  if (
    existing.status === "completed" &&
    existing.outputStorageRef &&
    existing.outputChecksum
  ) {
    return {
      kind: "hit",
      job: existing,
      response: {
        outputStorageRef: existing.outputStorageRef,
        outputChecksum: existing.outputChecksum,
        providerRequestId: existing.providerRequestId ?? undefined,
        providerResponseId: existing.providerResponseId ?? undefined,
        modelVersion: existing.modelVersion,
        limitations: [
          "Idempotent replay of a prior completed projection job — output was not regenerated.",
        ],
        planningAssumptions: [],
      },
    };
  }

  return { kind: "hit", job: existing };
}

export function assertNotConflict(resolution: IdempotencyResolution): void {
  if (resolution.kind === "conflict") {
    throw new ProjectionGatewayError(
      "idempotency_conflict",
      "Idempotency key was reused with a different request payload",
      409
    );
  }
}

export function jobAlreadyTerminal(job: ProjectionJobRecord): boolean {
  return TERMINAL_JOB_STATUSES.has(job.status);
}
