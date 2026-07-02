import "server-only";

import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH, timingSafeUtf8Equal } from "@/src/lib/security/timingSafeSecret";
import {
  isPathologyEmailIngestionEnabledFromEnv,
  readPathologyEmailAllowedSendersFromEnv,
  readPathologyEmailWebhookSecretFromEnv,
  type PathologyEmailIngestionEnvSlice,
} from "@/src/lib/pathology/email/pathologyEmailIngestionEnv";

export class PathologyEmailWebhookAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "PathologyEmailWebhookAuthError";
  }
}

export class PathologyEmailIngestionDisabledError extends Error {
  constructor() {
    super("Pathology email ingestion is disabled.");
    this.name = "PathologyEmailIngestionDisabledError";
  }
}

export class PathologyEmailSenderNotAllowedError extends Error {
  constructor() {
    super("Sender not allowed.");
    this.name = "PathologyEmailSenderNotAllowedError";
  }
}

const WEBHOOK_SECRET_HEADER = "x-pathology-email-webhook-secret";

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
export function assertPathologyEmailWebhookAuthorized(
  request: Request,
  env: PathologyEmailIngestionEnvSlice = process.env as PathologyEmailIngestionEnvSlice
): void {
  if (!isPathologyEmailIngestionEnabledFromEnv(env)) {
    throw new PathologyEmailIngestionDisabledError();
  }

  const isProd = process.env.NODE_ENV === "production";
  const configured = readPathologyEmailWebhookSecretFromEnv(env);

  if (isProd && (!configured || configured.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH)) {
    throw new PathologyEmailWebhookAuthError(503, "Service unavailable.");
  }

  if (!configured || configured.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
    throw new PathologyEmailWebhookAuthError(503, "Service unavailable.");
  }

  const token = extractWebhookSecret(request);
  if (!token) {
    throw new PathologyEmailWebhookAuthError(401, "Unauthorized.");
  }

  if (!timingSafeUtf8Equal(configured, token)) {
    throw new PathologyEmailWebhookAuthError(401, "Unauthorized.");
  }
}

/** Optional sender allowlist; empty env means accept all senders. */
export function assertPathologyEmailSenderAllowed(
  fromEmail: string | null | undefined,
  env: PathologyEmailIngestionEnvSlice = process.env as PathologyEmailIngestionEnvSlice
): void {
  const allowlist = readPathologyEmailAllowedSendersFromEnv(env);
  if (!allowlist.length) return;

  const from = fromEmail?.trim().toLowerCase() ?? "";
  if (!from || !allowlist.includes(from)) {
    throw new PathologyEmailSenderNotAllowedError();
  }
}
