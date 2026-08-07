/**
 * FI-SURGERY-PROJECTION-PROVIDER-ACTIVATION-1C — Shared openai-gpt-image configuration.
 * Missing or invalid configuration fails closed. Never falls back to overlay/stub as illustrative.
 */

export const SHARED_PROJECTION_PROVIDER_ID = "openai-gpt-image" as const;
export const SHARED_PROJECTION_ARTIFACT_TYPE = "illustrative_projected_outcome" as const;
export const SHARED_PROJECTION_MODEL_DEFAULT = "gpt-image-2" as const;

export const FI_SHARED_PROJECTION_PROVIDER_ENABLED_ENV =
  "FI_SHARED_PROJECTION_PROVIDER_ENABLED" as const;
export const FI_SHARED_PROJECTION_PROVIDER_ID_ENV =
  "FI_SHARED_PROJECTION_PROVIDER_ID" as const;
export const FI_SHARED_PROJECTION_MODEL_ENV = "FI_SHARED_PROJECTION_MODEL" as const;
export const FI_SHARED_PROJECTION_OUTPUT_QUALITY_ENV =
  "FI_SHARED_PROJECTION_OUTPUT_QUALITY" as const;
export const FI_SHARED_PROJECTION_OUTPUT_WIDTH_ENV =
  "FI_SHARED_PROJECTION_OUTPUT_WIDTH" as const;
export const FI_SHARED_PROJECTION_OUTPUT_HEIGHT_ENV =
  "FI_SHARED_PROJECTION_OUTPUT_HEIGHT" as const;
export const FI_SHARED_PROJECTION_TIMEOUT_MS_ENV =
  "FI_SHARED_PROJECTION_TIMEOUT_MS" as const;
export const FI_SHARED_PROJECTION_MAX_ATTEMPTS_ENV =
  "FI_SHARED_PROJECTION_MAX_ATTEMPTS" as const;
export const FI_SHARED_PROJECTION_COST_CEILING_USD_ENV =
  "FI_SHARED_PROJECTION_COST_CEILING_USD" as const;
export const FI_SHARED_PROJECTION_CONCURRENCY_LIMIT_ENV =
  "FI_SHARED_PROJECTION_CONCURRENCY_LIMIT" as const;
export const FI_SHARED_PROJECTION_ENV_ALLOWLIST_ENV =
  "FI_SHARED_PROJECTION_ENV_ALLOWLIST" as const;
export const FI_SHARED_PROJECTION_PILOT_TENANT_IDS_ENV =
  "FI_SHARED_PROJECTION_PILOT_TENANT_IDS" as const;
export const FI_SHARED_PROJECTION_DPIA_STATUS_ENV =
  "FI_SHARED_PROJECTION_DPIA_STATUS" as const;
export const FI_SHARED_PROJECTION_PROMPT_VERSION_ENV =
  "FI_SHARED_PROJECTION_PROMPT_VERSION" as const;
export const OPENAI_API_KEY_ENV = "OPENAI_API_KEY" as const;

export type SharedProjectionDpiaStatus =
  | "not_approved"
  | "approved_with_conditions"
  | "approved_for_controlled_pilot";

export type SharedProjectionOutputQuality = "low" | "medium" | "high" | "auto";

export type SharedProjectionProviderConfig = {
  enabled: boolean;
  providerId: typeof SHARED_PROJECTION_PROVIDER_ID;
  artifactType: typeof SHARED_PROJECTION_ARTIFACT_TYPE;
  model: string;
  outputQuality: SharedProjectionOutputQuality;
  outputWidth: number | null;
  outputHeight: number | null;
  timeoutMs: number;
  maxAttempts: number;
  costCeilingUsd: number;
  concurrencyLimit: number;
  envAllowlist: string[];
  pilotTenantIds: Set<string>;
  dpiaStatus: SharedProjectionDpiaStatus;
  promptTemplateVersion: string;
  apiKeyConfigured: boolean;
  apiKey: string | null;
  /** True only when all hard gates pass for attempting a paid clinical call. */
  mayInvokeProvider: boolean;
  configurationError: string | null;
};

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_COST_CEILING_USD = 2.5;
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_PROMPT_VERSION = "fi-openai-projected-outcome-prompt-v3";

function isAffirmative(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parsePositiveFloat(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseCsvSet(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const t = part.trim();
    if (t) out.add(t);
  }
  return out;
}

function parseCsvList(raw: string | undefined): string[] {
  return [...parseCsvSet(raw)];
}

function resolveRuntimeEnvLabel(env: NodeJS.ProcessEnv): string {
  const vercel = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercel) return vercel;
  const node = (env.NODE_ENV ?? "development").trim().toLowerCase();
  return node || "development";
}

function parseDpiaStatus(raw: string | undefined): SharedProjectionDpiaStatus {
  const v = (raw ?? "not_approved").trim().toLowerCase();
  if (v === "approved_with_conditions") return "approved_with_conditions";
  if (v === "approved_for_controlled_pilot") return "approved_for_controlled_pilot";
  return "not_approved";
}

function parseQuality(raw: string | undefined): SharedProjectionOutputQuality | null {
  const v = (raw ?? "high").trim().toLowerCase();
  if (v === "low" || v === "medium" || v === "high" || v === "auto") return v;
  return null;
}

/**
 * Resolve shared provider config. Invalid provider id / quality / DPIA gating → fail closed.
 */
export function resolveSharedProjectionProviderConfig(
  env: NodeJS.ProcessEnv = process.env
): SharedProjectionProviderConfig {
  const enabledFlag = isAffirmative(env[FI_SHARED_PROJECTION_PROVIDER_ENABLED_ENV]);
  const requestedId = (env[FI_SHARED_PROJECTION_PROVIDER_ID_ENV] ?? SHARED_PROJECTION_PROVIDER_ID)
    .trim()
    .toLowerCase();
  const model =
    (env[FI_SHARED_PROJECTION_MODEL_ENV] ?? SHARED_PROJECTION_MODEL_DEFAULT).trim() ||
    SHARED_PROJECTION_MODEL_DEFAULT;
  const quality = parseQuality(env[FI_SHARED_PROJECTION_OUTPUT_QUALITY_ENV]);
  const apiKey = (env[OPENAI_API_KEY_ENV] ?? "").trim() || null;
  const dpiaStatus = parseDpiaStatus(env[FI_SHARED_PROJECTION_DPIA_STATUS_ENV]);
  const runtime = resolveRuntimeEnvLabel(env);
  const envAllowlist = parseCsvList(
    env[FI_SHARED_PROJECTION_ENV_ALLOWLIST_ENV] ?? "development,preview"
  );
  const pilotTenantIds = parseCsvSet(env[FI_SHARED_PROJECTION_PILOT_TENANT_IDS_ENV]);
  const promptTemplateVersion =
    (env[FI_SHARED_PROJECTION_PROMPT_VERSION_ENV] ?? DEFAULT_PROMPT_VERSION).trim() ||
    DEFAULT_PROMPT_VERSION;

  let configurationError: string | null = null;
  if (requestedId !== SHARED_PROJECTION_PROVIDER_ID) {
    configurationError = `invalid_provider_id:${requestedId}`;
  } else if (!quality) {
    configurationError = "invalid_output_quality";
  } else if (!enabledFlag) {
    configurationError = "provider_disabled";
  } else if (!apiKey) {
    configurationError = "missing_openai_api_key";
  } else if (dpiaStatus === "not_approved") {
    configurationError = "dpia_not_approved";
  } else if (envAllowlist.length > 0 && !envAllowlist.includes(runtime)) {
    configurationError = `environment_not_allowlisted:${runtime}`;
  }

  const mayInvokeProvider = configurationError == null;

  return {
    enabled: enabledFlag && mayInvokeProvider,
    providerId: SHARED_PROJECTION_PROVIDER_ID,
    artifactType: SHARED_PROJECTION_ARTIFACT_TYPE,
    model,
    outputQuality: quality ?? "high",
    outputWidth: env[FI_SHARED_PROJECTION_OUTPUT_WIDTH_ENV]
      ? parsePositiveInt(env[FI_SHARED_PROJECTION_OUTPUT_WIDTH_ENV], 0) || null
      : null,
    outputHeight: env[FI_SHARED_PROJECTION_OUTPUT_HEIGHT_ENV]
      ? parsePositiveInt(env[FI_SHARED_PROJECTION_OUTPUT_HEIGHT_ENV], 0) || null
      : null,
    timeoutMs: parsePositiveInt(env[FI_SHARED_PROJECTION_TIMEOUT_MS_ENV], DEFAULT_TIMEOUT_MS),
    maxAttempts: parsePositiveInt(env[FI_SHARED_PROJECTION_MAX_ATTEMPTS_ENV], DEFAULT_MAX_ATTEMPTS),
    costCeilingUsd: parsePositiveFloat(
      env[FI_SHARED_PROJECTION_COST_CEILING_USD_ENV],
      DEFAULT_COST_CEILING_USD
    ),
    concurrencyLimit: parsePositiveInt(
      env[FI_SHARED_PROJECTION_CONCURRENCY_LIMIT_ENV],
      DEFAULT_CONCURRENCY
    ),
    envAllowlist,
    pilotTenantIds,
    dpiaStatus,
    promptTemplateVersion,
    apiKeyConfigured: Boolean(apiKey),
    apiKey,
    mayInvokeProvider,
    configurationError,
  };
}

export function assertProviderConfigAllowsGeneration(
  config: SharedProjectionProviderConfig,
  input: { tenantId: string; estimatedCostUsd: number }
): { ok: true } | { ok: false; code: string; message: string } {
  if (!config.mayInvokeProvider) {
    return {
      ok: false,
      code: config.configurationError ?? "provider_disabled",
      message:
        "Projected-outcome generation is unavailable because the imaging provider is not configured or privacy gates failed.",
    };
  }
  if (config.pilotTenantIds.size === 0) {
    return {
      ok: false,
      code: "pilot_tenant_allowlist_empty",
      message: "No pilot tenants are allowlisted for shared projection generation.",
    };
  }
  if (!config.pilotTenantIds.has(input.tenantId)) {
    return {
      ok: false,
      code: "tenant_not_allowlisted",
      message: "This tenant is not on the controlled pilot allowlist.",
    };
  }
  if (input.estimatedCostUsd > config.costCeilingUsd) {
    return {
      ok: false,
      code: "cost_ceiling_exceeded",
      message: "Estimated request cost exceeds the configured ceiling.",
    };
  }
  return { ok: true };
}

/** Deterministic pilot cost estimate (USD) — not a billing quote. */
export function estimateSharedProjectionCostUsd(input: {
  quality: SharedProjectionOutputQuality;
}): number {
  switch (input.quality) {
    case "low":
      return 0.04;
    case "medium":
      return 0.12;
    case "auto":
      return 0.2;
    case "high":
    default:
      return 0.25;
  }
}

export function dpiaPermitsClinicalImageProcessing(
  status: SharedProjectionDpiaStatus
): boolean {
  return (
    status === "approved_with_conditions" || status === "approved_for_controlled_pilot"
  );
}
