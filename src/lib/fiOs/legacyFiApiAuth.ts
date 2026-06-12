/**
 * Gate for legacy unauthenticated `/api/fi/*` machine routes (events, submit, uploads, cases, partners, run-model).
 * Controlled by FI_LEGACY_FI_API_ENABLED + FI_LEGACY_FI_API_SECRET (Bearer only; never query params).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export type LegacyFiApiAuthEnv = Record<string, string | undefined>;

const ENABLED_VALUES = new Set(["1", "true", "yes"]);

/** True only when FI_LEGACY_FI_API_ENABLED is an explicit affirmative (default false if unset). */
export function isLegacyFiApiEnabled(env: LegacyFiApiAuthEnv = process.env): boolean {
  const raw = env.FI_LEGACY_FI_API_ENABLED;
  if (raw === undefined || raw === "") return false;
  return ENABLED_VALUES.has(raw.trim().toLowerCase());
}

/**
 * Constant-time comparison of two strings via SHA-256 digests (avoids length leaks on the configured secret).
 */
export function safeTimingEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const m = /^Bearer\s+(\S+)/i.exec(authorization.trim());
  return m?.[1] ?? null;
}

export type LegacyFiApiAuthFailure =
  | { status: 404; body: { error: string } }
  | { status: 401; body: { error: string } }
  | { status: 503; body: { error: string } };

/**
 * Evaluate access without NextResponse (unit-test friendly).
 */
export function evaluateLegacyFiApiAccess(
  request: Request,
  env: LegacyFiApiAuthEnv = process.env
): LegacyFiApiAuthFailure | null {
  if (!isLegacyFiApiEnabled(env)) {
    return { status: 404, body: { error: "Not found." } };
  }

  const configuredSecret = (env.FI_LEGACY_FI_API_SECRET ?? "").trim();
  if (!configuredSecret) {
    return { status: 503, body: { error: "Service unavailable." } };
  }

  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token || !safeTimingEqual(token, configuredSecret)) {
    return { status: 401, body: { error: "Unauthorized." } };
  }

  return null;
}

/** Returns a NextResponse when the request must be blocked; otherwise null (caller continues). */
export function assertLegacyFiApiAccess(request: Request): NextResponse | null {
  const failure = evaluateLegacyFiApiAccess(request, process.env);
  if (!failure) return null;
  return NextResponse.json(failure.body, { status: failure.status });
}
