/**
 * Shared Bearer auth for FI OS cron route handlers (`/api/cron/financial-os/*`, payment reminders).
 * Returns boolean only — callers map `false` to HTTP 401. Never logs or returns secret values.
 */
import type { NextRequest } from "next/server";

import {
  CRON_OR_WEBHOOK_SECRET_MIN_LENGTH,
  timingSafeUtf8Equal,
} from "@/src/lib/security/timingSafeSecret";

const FI_OS_CRON_SECRET_ENV_KEYS = [
  "CRON_SECRET",
  "FINANCIAL_OS_CRON_SECRET",
  "FI_PAYMENTS_CRON_SECRET",
] as const;

function extractBearerToken(authorization: string | null): string | null {
  const m = authorization?.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function collectConfiguredCronSecrets(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of FI_OS_CRON_SECRET_ENV_KEYS) {
    const trimmed = process.env[key]?.trim();
    if (!trimmed || trimmed.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Validates `Authorization: Bearer <secret>` against configured FI OS cron secrets.
 * Accepts any non-empty env value (≥16 chars) for `CRON_SECRET`, `FINANCIAL_OS_CRON_SECRET`, or `FI_PAYMENTS_CRON_SECRET`.
 */
export function validateCronAuth(req: NextRequest): boolean {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) return false;

  const secrets = collectConfiguredCronSecrets();
  if (secrets.length === 0) return false;

  for (const expected of secrets) {
    if (timingSafeUtf8Equal(expected, token)) return true;
  }
  return false;
}
