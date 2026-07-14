import { isAffirmative } from "@/src/lib/env/zod-helpers";

export type GenericEmailActivityIngestionEnvSlice = Partial<
  Record<"GENERIC_CLINIC_EMAIL_INGESTION_ENABLED" | "GENERIC_CLINIC_EMAIL_WEBHOOK_SECRET", string>
>;

/** When true, POST /api/tenants/[tenantId]/integrations/generic-email/ingest accepts payloads. */
export function isGenericClinicEmailIngestionEnabledFromEnv(
  env: GenericEmailActivityIngestionEnvSlice = process.env as GenericEmailActivityIngestionEnvSlice
): boolean {
  return isAffirmative(env.GENERIC_CLINIC_EMAIL_INGESTION_ENABLED);
}

export function readGenericClinicEmailWebhookSecretFromEnv(
  env: GenericEmailActivityIngestionEnvSlice = process.env as GenericEmailActivityIngestionEnvSlice
): string {
  return env.GENERIC_CLINIC_EMAIL_WEBHOOK_SECRET?.trim() ?? "";
}
