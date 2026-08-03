import "server-only";

export const FI_ENABLE_HLI_TRICHOSCOPY = "FI_ENABLE_HLI_TRICHOSCOPY" as const;

export type HliTrichoscopyConfig = {
  enabled: boolean;
  apiBaseUrl: string | null;
  serviceKey: string | null;
  signingSecret: string | null;
  webhookSecret: string | null;
  requestTimeoutMs: number;
  maxRetries: number;
  /** When true, outbound commands use in-process stub (CI / local without HLI). */
  useStub: boolean;
};

function isAffirmative(raw: string | undefined): boolean {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function parseIntEnv(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadHliTrichoscopyConfig(env: NodeJS.ProcessEnv = process.env): HliTrichoscopyConfig {
  const enabled = isAffirmative(env[FI_ENABLE_HLI_TRICHOSCOPY]);
  const apiBaseUrl = env.HLI_TRICHOSCOPY_API_BASE_URL?.trim() || null;
  const serviceKey = env.HLI_TRICHOSCOPY_SERVICE_KEY?.trim() || null;
  const signingSecret = env.HLI_TRICHOSCOPY_SIGNING_SECRET?.trim() || null;
  const webhookSecret = env.HLI_TRICHOSCOPY_WEBHOOK_SECRET?.trim() || null;
  const useStub = !apiBaseUrl || !serviceKey || !signingSecret;

  return {
    enabled,
    apiBaseUrl,
    serviceKey,
    signingSecret,
    webhookSecret,
    requestTimeoutMs: parseIntEnv(env.HLI_TRICHOSCOPY_REQUEST_TIMEOUT_MS, 10_000),
    maxRetries: parseIntEnv(env.HLI_TRICHOSCOPY_MAX_RETRIES, 2),
    useStub,
  };
}

export function assertHliTrichoscopyConfiguredForOutbound(config: HliTrichoscopyConfig): void {
  if (!config.enabled) {
    throw new Error("HLI trichoscopy platform flag is disabled.");
  }
}
