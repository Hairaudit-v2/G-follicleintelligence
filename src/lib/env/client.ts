/**
 * Validated NEXT_PUBLIC_* environment variables.
 * Safe to import from Client Components — contains no server secrets.
 */
import { clientEnvKeys, parseClientEnv, type ClientEnv, type ClientEnvKey } from "./schema";
import { shouldSkipEnvValidation } from "./zod-helpers";

export type { ClientEnv, ClientEnvKey };
export { clientEnvKeys };

function loadClientEnv(): ClientEnv {
  return parseClientEnv(process.env, { skipValidation: shouldSkipEnvValidation() });
}

/** Validated public env — import this in client and shared code only. */
export const clientEnv: ClientEnv = loadClientEnv();

/** Re-parse client env (tests, scripts). */
export function getClientEnv(runtimeEnv: NodeJS.ProcessEnv = process.env): ClientEnv {
  return parseClientEnv(runtimeEnv, { skipValidation: shouldSkipEnvValidation(runtimeEnv) });
}
