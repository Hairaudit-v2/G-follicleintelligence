import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH } from "@/src/lib/security/timingSafeSecret";

function truthyEnv(v: string | undefined): boolean {
  const s = v?.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function readFiOsNexusEnabled(): boolean {
  return truthyEnv(process.env.FI_OS_NEXUS_ENABLED);
}

export function readFiOsNexusCreateAuthUser(): boolean {
  return truthyEnv(process.env.FI_OS_NEXUS_CREATE_AUTH_USER);
}

export function readFiOsNexusSecret(): string | null {
  const secret = process.env.FI_OS_NEXUS_SECRET?.trim();
  if (!secret || secret.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
    return null;
  }
  return secret;
}

export type FiOsNexusEnvSnapshot = {
  enabled: boolean;
  secretConfigured: boolean;
  createAuthUser: boolean;
};

export function readFiOsNexusEnvSnapshot(
  env: NodeJS.ProcessEnv = process.env
): FiOsNexusEnvSnapshot {
  const secret = env.FI_OS_NEXUS_SECRET?.trim() ?? "";
  return {
    enabled: truthyEnv(env.FI_OS_NEXUS_ENABLED),
    secretConfigured: secret.length >= CRON_OR_WEBHOOK_SECRET_MIN_LENGTH,
    createAuthUser: truthyEnv(env.FI_OS_NEXUS_CREATE_AUTH_USER),
  };
}
