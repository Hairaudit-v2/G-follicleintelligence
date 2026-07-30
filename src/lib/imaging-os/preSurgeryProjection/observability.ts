/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Structured observability (no secrets/PHI/imagery).
 */

import type { ProjectionDomainEvent } from "./types";

export type ProjectionLogFields = {
  event: ProjectionDomainEvent;
  jobId?: string | null;
  caseId?: string | null;
  externalCaseId?: string | null;
  tenantId?: string | null;
  clinicId?: string | null;
  sourceChannel?: string | null;
  provider?: string | null;
  status?: string | null;
  reason?: string | null;
  httpStatus?: number | null;
  idempotencyKeyPrefix?: string | null;
  attempt?: number | null;
};

function redactKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return key.length <= 8 ? `${key.slice(0, 2)}…` : `${key.slice(0, 8)}…`;
}

export function logProjectionEvent(fields: ProjectionLogFields): void {
  const payload = {
    scope: "fi_pre_surgery_projection",
    ...fields,
    idempotencyKeyPrefix: fields.idempotencyKeyPrefix
      ? redactKey(fields.idempotencyKeyPrefix)
      : undefined,
    ts: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console -- structured gateway audit trail
  console.info(JSON.stringify(payload));
}
