import "server-only";

import {
  CRON_OR_WEBHOOK_SECRET_MIN_LENGTH,
  timingSafeUtf8Equal,
} from "@/src/lib/security/timingSafeSecret";
import {
  isGenericClinicEmailIngestionEnabledFromEnv,
  readGenericClinicEmailWebhookSecretFromEnv,
  type GenericEmailActivityIngestionEnvSlice,
} from "./genericEmailActivityIngestionEnv";

export class GenericEmailWebhookAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "GenericEmailWebhookAuthError";
  }
}

export class GenericEmailIngestionDisabledError extends Error {
  constructor() {
    super("Generic clinic email ingestion is disabled.");
    this.name = "GenericEmailIngestionDisabledError";
  }
}

const WEBHOOK_SECRET_HEADER = "x-generic-clinic-email-webhook-secret";

function extractBearerToken(request: Request): string | null {
  const raw = request.headers.get("authorization")?.trim();
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() || null;
}

function extractWebhookSecret(request: Request): string | null {
  const header = request.headers.get(WEBHOOK_SECRET_HEADER)?.trim();
  if (header) return header;
  return extractBearerToken(request);
}

/** Reject when feature flag off or shared secret missing/invalid. */
export function assertGenericClinicEmailWebhookAuthorized(
  request: Request,
  env: GenericEmailActivityIngestionEnvSlice = process.env as GenericEmailActivityIngestionEnvSlice
): void {
  if (!isGenericClinicEmailIngestionEnabledFromEnv(env)) {
    throw new GenericEmailIngestionDisabledError();
  }

  const configured = readGenericClinicEmailWebhookSecretFromEnv(env);
  if (!configured || configured.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
    throw new GenericEmailWebhookAuthError(503, "Service unavailable.");
  }

  const token = extractWebhookSecret(request);
  if (!token) {
    throw new GenericEmailWebhookAuthError(401, "Unauthorized.");
  }

  if (!timingSafeUtf8Equal(configured, token)) {
    throw new GenericEmailWebhookAuthError(401, "Unauthorized.");
  }
}
