/**
 * Central FI OS server environment validation (no secrets logged).
 * Safe to import from scripts and `pnpm run check:env`; do not import from client components.
 */
import { z } from "zod";

export type FiEnvValidationResult = { ok: true } | { ok: false; errors: string[] };

const AFFIRMATIVE = new Set(["1", "true", "yes", "on"]);

function isAffirmative(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return false;
  return AFFIRMATIVE.has(raw.trim().toLowerCase());
}

function isPresent(raw: string | undefined): boolean {
  return raw !== undefined && raw.trim() !== "";
}

function minSecretLength(name: string, raw: string | undefined, min: number, errors: string[]): void {
  if (!isPresent(raw)) return;
  if (raw!.trim().length < min) errors.push(name);
}

const nonEmptyHttpUrl = z
  .string()
  .trim()
  .min(1)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be a valid http(s) URL.");

/**
 * Pure validation: pass `process.env` or a fixture for tests. Never includes secret values in the result.
 */
export function validateFiServerEnv(env: NodeJS.ProcessEnv = process.env): FiEnvValidationResult {
  const errors: string[] = [];
  const g = (k: string) => env[k];

  const nodeEnv = g("NODE_ENV")?.trim() || "development";
  const isProd = nodeEnv === "production";

  const supabaseUrl = g("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnon = g("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRole = g("SUPABASE_SERVICE_ROLE_KEY");

  if (isProd) {
    if (!nonEmptyHttpUrl.safeParse(supabaseUrl).success) errors.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!isPresent(supabaseAnon)) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!isPresent(serviceRole)) errors.push("SUPABASE_SERVICE_ROLE_KEY");

    if (isAffirmative(g("FI_ALLOW_INSECURE_API"))) errors.push("FI_ALLOW_INSECURE_API");
    if (isAffirmative(g("FI_ALLOW_ADMIN_KEY_QUERY"))) errors.push("FI_ALLOW_ADMIN_KEY_QUERY");

    if (isAffirmative(g("FI_LEGACY_FI_API_ENABLED"))) {
      const secret = g("FI_LEGACY_FI_API_SECRET");
      if (!isPresent(secret) || secret!.trim().length < 16) {
        errors.push("FI_LEGACY_FI_API_SECRET");
      }
    }

    if (isAffirmative(g("FI_REMINDERS_LIVE_DELIVERY"))) {
      if (!isPresent(g("RESEND_API_KEY"))) errors.push("RESEND_API_KEY");
      if (!isPresent(g("RESEND_FROM_EMAIL"))) errors.push("RESEND_FROM_EMAIL");
    }
  } else if (isPresent(supabaseUrl) && !nonEmptyHttpUrl.safeParse(supabaseUrl).success) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  minSecretLength("FI_REMINDER_CRON_SECRET", g("FI_REMINDER_CRON_SECRET"), 16, errors);
  minSecretLength("CRON_SECRET", g("CRON_SECRET"), 16, errors);
  minSecretLength("FI_TIMELY_WEBHOOK_SECRET", g("FI_TIMELY_WEBHOOK_SECRET"), 16, errors);
  minSecretLength("IIOHR_HR_SYNC_SECRET", g("IIOHR_HR_SYNC_SECRET"), 16, errors);

  const openAi = g("OPENAI_API_KEY");
  if (openAi !== undefined && openAi.trim().length === 0) {
    errors.push("OPENAI_API_KEY");
  }

  const adminKey = g("FI_ADMIN_API_KEY");
  if (isPresent(adminKey) && adminKey!.trim().length < 20) {
    errors.push("FI_ADMIN_API_KEY");
  }

  if (errors.length) {
    const deduped = errors.filter((e, i, a) => a.indexOf(e) === i).sort();
    return { ok: false, errors: deduped };
  }
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
