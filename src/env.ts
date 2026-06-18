/**
 * Environment validation entry point.
 *
 * Import paths (enforced by module boundaries):
 * - **Client Components / browser code:** `@/src/env/client` → `clientEnv`
 * - **Server-only code:** `@/src/env/server` → `env`, `serverEnv`
 *
 * Never import `@/src/env/server` from a file marked `"use client"`.
 * The `server-only` package throws at build time if you do.
 *
 * Startup validation runs from `instrumentation.ts` on the Node.js runtime.
 * CI / deploy gate: `pnpm run check:env`
 * Skip validation (e.g. Docker build without secrets): `SKIP_ENV_VALIDATION=1`
 */
export type { ClientEnv, ClientEnvKey } from "./lib/env/client";
export { clientEnv, clientEnvKeys, getClientEnv } from "./lib/env/client";

export type { Env, ServerEnv } from "./lib/env/server";
export {
  assertEnvOnStartup,
  assertValidEnv,
  env,
  EnvValidationError,
  getEnv,
  getServerEnv,
  serverEnv,
  validateFullEnv,
} from "./lib/env/server";
