/**
 * Central FI OS server environment validation (no secrets logged).
 * Safe to import from scripts and `pnpm run check:env`; do not import from client components.
 *
 * @deprecated Prefer `assertValidEnv` / `validateFullEnv` from `@/src/env/server` (Zod-based).
 */
import { collectLegacyVariableNames } from "./schema";

export type FiEnvValidationResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Pure validation: pass `process.env` or a fixture for tests. Never includes secret values in the result.
 */
export function validateFiServerEnv(env: NodeJS.ProcessEnv = process.env): FiEnvValidationResult {
  const errors = collectLegacyVariableNames(env);
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

export class FiEnvValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`FI OS environment validation failed: ${errors.join(", ")}`);
    this.name = "FiEnvValidationError";
  }
}

/** Throws {@link FiEnvValidationError} with variable names only when validation fails. */
export function assertFiServerEnv(env: NodeJS.ProcessEnv = process.env): void {
  const r = validateFiServerEnv(env);
  if (!r.ok) throw new FiEnvValidationError(r.errors);
}
