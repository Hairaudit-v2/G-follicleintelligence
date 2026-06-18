/**
 * Validated server environment variables.
 * `import "server-only"` prevents accidental imports from Client Components.
 */
import "server-only";

import { clientEnv, getClientEnv } from "./client";
import {
  assertValidEnv,
  EnvValidationError,
  parseServerEnv,
  validateFullEnv,
  type ServerEnv,
} from "./schema";
import { shouldSkipEnvValidation } from "./zod-helpers";

export type { ServerEnv };
export { EnvValidationError, assertValidEnv, validateFullEnv };

function loadServerEnv(): ServerEnv {
  return parseServerEnv(process.env, { skipValidation: shouldSkipEnvValidation() });
}

/** Server-only secrets and configuration (never expose to the browser). */
export const serverEnv: ServerEnv = loadServerEnv();

/**
 * Full validated environment for server code: public client vars + server secrets.
 * Import only from Server Components, Route Handlers, Server Actions, and scripts.
 */
export const env = {
  ...clientEnv,
  ...serverEnv,
} as const;

export type Env = typeof env;

/** Re-parse server env (tests, scripts). */
export function getServerEnv(runtimeEnv: NodeJS.ProcessEnv = process.env): ServerEnv {
  return parseServerEnv(runtimeEnv, { skipValidation: shouldSkipEnvValidation(runtimeEnv) });
}

/** Re-parse combined env (tests, scripts). */
export function getEnv(runtimeEnv: NodeJS.ProcessEnv = process.env) {
  const skip = shouldSkipEnvValidation(runtimeEnv);
  return {
    ...getClientEnv(runtimeEnv),
    ...getServerEnv(runtimeEnv),
  } as const;
}

let startupAsserted = false;

/**
 * Validates client + server env on Node.js startup (instrumentation hook, scripts).
 * Idempotent — safe if called more than once per process.
 */
export function assertEnvOnStartup(runtimeEnv: NodeJS.ProcessEnv = process.env): void {
  if (startupAsserted || shouldSkipEnvValidation(runtimeEnv)) return;
  assertValidEnv(runtimeEnv);
  startupAsserted = true;
}
