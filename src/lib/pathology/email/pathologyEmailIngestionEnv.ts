import { isAffirmative } from "@/src/lib/env/zod-helpers";

export type PathologyEmailIngestionEnvSlice = Partial<
  Record<
    | "PATHOLOGY_EMAIL_INGESTION_ENABLED"
    | "PATHOLOGY_EMAIL_WEBHOOK_SECRET"
    | "PATHOLOGY_EMAIL_ALLOWED_SENDERS"
    | "PATHOLOGY_EMAIL_MAX_ATTACHMENT_MB",
    string
  >
>;

const DEFAULT_MAX_ATTACHMENT_MB = 15;

/** When true, POST /api/integrations/pathology-email/inbound accepts provider webhooks. */
export function isPathologyEmailIngestionEnabledFromEnv(
  env: PathologyEmailIngestionEnvSlice = process.env as PathologyEmailIngestionEnvSlice
): boolean {
  return isAffirmative(env.PATHOLOGY_EMAIL_INGESTION_ENABLED);
}

export function readPathologyEmailWebhookSecretFromEnv(
  env: PathologyEmailIngestionEnvSlice = process.env as PathologyEmailIngestionEnvSlice
): string {
  return env.PATHOLOGY_EMAIL_WEBHOOK_SECRET?.trim() ?? "";
}

/** Comma-separated allowlist; empty means any sender is accepted. */
export function readPathologyEmailAllowedSendersFromEnv(
  env: PathologyEmailIngestionEnvSlice = process.env as PathologyEmailIngestionEnvSlice
): string[] {
  const raw = env.PATHOLOGY_EMAIL_ALLOWED_SENDERS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function readPathologyEmailMaxAttachmentBytesFromEnv(
  env: PathologyEmailIngestionEnvSlice = process.env as PathologyEmailIngestionEnvSlice
): number {
  const raw = env.PATHOLOGY_EMAIL_MAX_ATTACHMENT_MB?.trim();
  const mb = raw ? Number(raw) : DEFAULT_MAX_ATTACHMENT_MB;
  if (!Number.isFinite(mb) || mb <= 0) return DEFAULT_MAX_ATTACHMENT_MB * 1024 * 1024;
  return Math.floor(mb * 1024 * 1024);
}
