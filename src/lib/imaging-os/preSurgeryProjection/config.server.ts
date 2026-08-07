/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Server config + feature flags.
 */

import "server-only";

import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH } from "@/src/lib/security/timingSafeSecret";
import type { ProjectionProviderName, ProviderStateReport } from "./types";

export const HAIRAUDIT_PROJECTION_SERVICE_TOKEN_ENV = "HAIRAUDIT_PROJECTION_SERVICE_TOKEN" as const;
export const HAIRAUDIT_PROJECTION_REQUEST_SIGNING_SECRET_ENV =
  "HAIRAUDIT_PROJECTION_REQUEST_SIGNING_SECRET" as const;
export const HAIRAUDIT_PROJECTION_CALLBACK_SIGNING_SECRET_ENV =
  "HAIRAUDIT_PROJECTION_CALLBACK_SIGNING_SECRET" as const;
export const HAIRAUDIT_PROJECTION_CALLBACK_BASE_URL_ENV =
  "HAIRAUDIT_PROJECTION_CALLBACK_BASE_URL" as const;
export const FI_PRE_SURGERY_PROJECTION_PROVIDER_ENV = "FI_PRE_SURGERY_PROJECTION_PROVIDER" as const;
export const FI_PRE_SURGERY_PROJECTION_ALLOW_STUB_IN_PRODUCTION_ENV =
  "FI_PRE_SURGERY_PROJECTION_ALLOW_STUB_IN_PRODUCTION" as const;
export const FI_PRE_SURGERY_PROJECTION_ENABLED_ENV = "FI_PRE_SURGERY_PROJECTION_ENABLED" as const;
export const FI_PRE_SURGERY_PROJECTION_HAIRAUDIT_ENABLED_ENV =
  "FI_PRE_SURGERY_PROJECTION_HAIRAUDIT_ENABLED" as const;
export const FI_PRE_SURGERY_PROJECTION_CLINIC_ENABLED_ENV =
  "FI_PRE_SURGERY_PROJECTION_CLINIC_ENABLED" as const;
export const FI_PRE_SURGERY_PROJECTION_PATIENT_SHARING_ENABLED_ENV =
  "FI_PRE_SURGERY_PROJECTION_PATIENT_SHARING_ENABLED" as const;
export const HAIRAUDIT_PROJECTION_FIOS_TENANT_ID_ENV = "HAIRAUDIT_PROJECTION_FIOS_TENANT_ID" as const;
export const HAIRAUDIT_PROJECTION_FIOS_CLINIC_ID_ENV = "HAIRAUDIT_PROJECTION_FIOS_CLINIC_ID" as const;
export const FI_PRE_SURGERY_PROJECTION_TIMESTAMP_SKEW_SECONDS_ENV =
  "FI_PRE_SURGERY_PROJECTION_TIMESTAMP_SKEW_SECONDS" as const;
export const FI_PRE_SURGERY_PROJECTION_STORAGE_BUCKET_ENV =
  "FI_PRE_SURGERY_PROJECTION_STORAGE_BUCKET" as const;
export const FI_PRE_SURGERY_PROJECTION_REQUIRE_HMAC_ENV =
  "FI_PRE_SURGERY_PROJECTION_REQUIRE_HMAC" as const;
export const FI_PRE_SURGERY_PROJECTION_SYNC_BUDGET_MS_ENV =
  "FI_PRE_SURGERY_PROJECTION_SYNC_BUDGET_MS" as const;

export const DEFAULT_PROJECTION_PATH = "/v1/pre-surgery/projections" as const;
export const DEFAULT_TIMESTAMP_SKEW_SECONDS = 300;
export const DEFAULT_STORAGE_BUCKET = "pre-surgery-projections";
export const DEFAULT_SYNC_BUDGET_MS = 25_000;
export const DEFAULT_CALLBACK_MAX_ATTEMPTS = 3;

export const HDR_IDEMPOTENCY_KEY = "idempotency-key" as const;
export const HDR_HA_TIMESTAMP = "x-hairaudit-timestamp" as const;
export const HDR_HA_CASE_ID = "x-hairaudit-case-id" as const;
export const HDR_HA_SIGNATURE = "x-hairaudit-signature" as const;
export const HDR_HA_PROJECTION_ID = "x-hairaudit-projection-id" as const;

function isAffirmative(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export type ProjectionGatewayConfig = {
  enabled: boolean;
  hairauditEnabled: boolean;
  clinicEnabled: boolean;
  patientSharingEnabled: boolean;
  provider: ProjectionProviderName;
  allowStubInProduction: boolean;
  serviceToken: string | null;
  requestSigningSecret: string | null;
  callbackSigningSecret: string | null;
  callbackBaseUrl: string | null;
  requireHmac: boolean;
  timestampSkewSeconds: number;
  storageBucket: string;
  hairauditTenantId: string | null;
  hairauditClinicId: string | null;
  syncBudgetMs: number;
  supabaseConfigured: boolean;
};

export function resolveProjectionGatewayConfig(
  env: NodeJS.ProcessEnv = process.env
): ProjectionGatewayConfig {
  const rawProvider = (env[FI_PRE_SURGERY_PROJECTION_PROVIDER_ENV] ?? "stub").trim().toLowerCase();
  const provider: ProjectionProviderName =
    rawProvider === "disabled"
      ? "disabled"
      : rawProvider === "openai-gpt-image" || rawProvider === "openai"
        ? "openai-gpt-image"
        : "stub";


  const skewRaw = env[FI_PRE_SURGERY_PROJECTION_TIMESTAMP_SKEW_SECONDS_ENV]?.trim();
  const skewParsed = skewRaw ? Number.parseInt(skewRaw, 10) : NaN;
  const timestampSkewSeconds =
    Number.isFinite(skewParsed) && skewParsed > 0 ? skewParsed : DEFAULT_TIMESTAMP_SKEW_SECONDS;

  const syncRaw = env[FI_PRE_SURGERY_PROJECTION_SYNC_BUDGET_MS_ENV]?.trim();
  const syncParsed = syncRaw ? Number.parseInt(syncRaw, 10) : NaN;

  return {
    enabled: isAffirmative(env[FI_PRE_SURGERY_PROJECTION_ENABLED_ENV]),
    hairauditEnabled: isAffirmative(env[FI_PRE_SURGERY_PROJECTION_HAIRAUDIT_ENABLED_ENV]),
    clinicEnabled: isAffirmative(env[FI_PRE_SURGERY_PROJECTION_CLINIC_ENABLED_ENV]),
    patientSharingEnabled: isAffirmative(env[FI_PRE_SURGERY_PROJECTION_PATIENT_SHARING_ENABLED_ENV]),
    provider,
    allowStubInProduction: isAffirmative(env[FI_PRE_SURGERY_PROJECTION_ALLOW_STUB_IN_PRODUCTION_ENV]),
    serviceToken: env[HAIRAUDIT_PROJECTION_SERVICE_TOKEN_ENV]?.trim() || null,
    requestSigningSecret: env[HAIRAUDIT_PROJECTION_REQUEST_SIGNING_SECRET_ENV]?.trim() || null,
    callbackSigningSecret: env[HAIRAUDIT_PROJECTION_CALLBACK_SIGNING_SECRET_ENV]?.trim() || null,
    callbackBaseUrl: env[HAIRAUDIT_PROJECTION_CALLBACK_BASE_URL_ENV]?.trim().replace(/\/$/, "") || null,
    requireHmac: isAffirmative(env[FI_PRE_SURGERY_PROJECTION_REQUIRE_HMAC_ENV]) || isProductionRuntime(env),
    timestampSkewSeconds,
    storageBucket:
      env[FI_PRE_SURGERY_PROJECTION_STORAGE_BUCKET_ENV]?.trim() || DEFAULT_STORAGE_BUCKET,
    hairauditTenantId: env[HAIRAUDIT_PROJECTION_FIOS_TENANT_ID_ENV]?.trim() || null,
    hairauditClinicId: env[HAIRAUDIT_PROJECTION_FIOS_CLINIC_ID_ENV]?.trim() || null,
    syncBudgetMs:
      Number.isFinite(syncParsed) && syncParsed > 0 ? syncParsed : DEFAULT_SYNC_BUDGET_MS,
    supabaseConfigured: Boolean(
      env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    ),
  };
}

export function validateProjectionServiceToken(
  env: NodeJS.ProcessEnv = process.env
): { valid: true; token: string } | { valid: false; reason: "missing_config" | "too_short" | "service_role_reused" } {
  const token = env[HAIRAUDIT_PROJECTION_SERVICE_TOKEN_ENV]?.trim();
  if (!token) return { valid: false, reason: "missing_config" };
  if (token.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) return { valid: false, reason: "too_short" };
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole && token === serviceRole) return { valid: false, reason: "service_role_reused" };
  return { valid: true, token };
}

export function reportProviderState(config: ProjectionGatewayConfig): ProviderStateReport {
  if (!config.enabled || config.provider === "disabled") {
    return "PROVIDER_DISABLED";
  }
  if (config.provider === "openai-gpt-image") {
    return "REAL_PROVIDER_CONNECTED";
  }
  if (config.provider === "stub") {
    if (isProductionRuntime() && !config.allowStubInProduction) {
      return "PROVIDER_DISABLED";
    }
    return "STUB_ONLY_NON_PRODUCTION";
  }
  return "PROVIDER_DISABLED";
}

export function assertGenerationAllowed(config: ProjectionGatewayConfig): void {
  if (!config.enabled) {
    throw Object.assign(new Error("feature_disabled"), { code: "feature_disabled" });
  }
  if (config.provider === "disabled") {
    throw Object.assign(new Error("provider_disabled"), { code: "provider_disabled" });
  }
  if (config.provider === "stub" && isProductionRuntime() && !config.allowStubInProduction) {
    throw Object.assign(new Error("stub_blocked_in_production"), {
      code: "stub_blocked_in_production",
    });
  }
}
