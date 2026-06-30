/**
 * Cron Bearer auth for Next.js Route Handlers and server-only modules.
 * Do not import from client components.
 */
import { NextRequest, NextResponse } from "next/server";

import {
  CRON_OR_WEBHOOK_SECRET_MIN_LENGTH,
  timingSafeUtf8Equal,
} from "@/src/lib/security/timingSafeSecret";

export class CronEnvError extends Error {
  constructor(public readonly envKey: string) {
    super(`Missing required environment variable: ${envKey}`);
    this.name = "CronEnvError";
  }
}

function extractBearerToken(authorization: string | null): string | null {
  const auth = authorization;
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function collectCronSecrets(allowedSecrets: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of allowedSecrets) {
    const t = raw?.trim();
    if (!t || t.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export type CronBearerAuthOptions = {
  /**
   * Optional extra header whose value is compared (timing-safe) to the same secret list as Bearer.
   * Used by reminder cron for `x-fi-reminder-secret` compatibility with existing schedulers.
   */
  alternateTimingSafeHeaderName?: string;
};

/**
 * Verifies cron / job caller auth via `Authorization: Bearer <secret>`.
 * Optionally compares {@link CronBearerAuthOptions.alternateTimingSafeHeaderName} to the same secret list.
 *
 * Returns `null` when authorised. Returns a JSON {@link NextResponse} (401 or 503) when not.
 *
 * **Vercel Cron:** Vercel sends `Authorization: Bearer` using the project env `CRON_SECRET`. Include that
 * value in `allowedSecrets` (e.g. alongside `FI_REMINDER_CRON_SECRET`) so native Vercel schedules work.
 */
export function assertCronAuthorized(
  req: NextRequest,
  allowedSecrets: string[],
  options?: CronBearerAuthOptions
): NextResponse | null {
  const secrets = collectCronSecrets(allowedSecrets);
  if (secrets.length === 0) {
    return NextResponse.json({ ok: false, error: "Service unavailable." }, { status: 503 });
  }

  const bearer = extractBearerToken(req.headers.get("authorization"));
  const altName = options?.alternateTimingSafeHeaderName?.trim();
  const alt = altName ? req.headers.get(altName)?.trim() || null : null;

  const candidates = [
    ...new Set([bearer, alt].filter((x): x is string => Boolean(x && x.length > 0))),
  ];
  if (candidates.length === 0) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let authorized = false;
  for (const token of candidates) {
    for (const expected of secrets) {
      if (timingSafeUtf8Equal(expected, token)) {
        authorized = true;
        break;
      }
    }
    if (authorized) break;
  }

  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

/**
 * Reads a required deployment env var. Throws {@link CronEnvError} when missing or whitespace-only.
 * Callers should catch and map to a generic HTTP error without echoing `envKey` to clients.
 */
export function getRequiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new CronEnvError(name);
  }
  return v;
}
