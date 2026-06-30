/**
 * FI admin API key extraction for HTTP routes: headers, optional query (dev-only flag), JSON body.
 * Query-string `adminKey` is never read in production; non-production requires `FI_ALLOW_ADMIN_KEY_QUERY`.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export type FiAdminKeyTransportEnv = Record<string, string | undefined>;

const AFFIRMATIVE = new Set(["1", "true", "yes"]);

/** Production always blocks `?adminKey=`; non-production only when flag is set. */
export function isAdminKeyQueryAllowed(env: FiAdminKeyTransportEnv = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  const raw = env.FI_ALLOW_ADMIN_KEY_QUERY;
  if (raw === undefined || raw === "") return false;
  return AFFIRMATIVE.has(raw.trim().toLowerCase());
}

/** Timing-safe equality for admin key material (SHA-256 digests, fixed length). */
export function safeTimingEqualAdminKey(candidate: string, configured: string): boolean {
  const ha = createHash("sha256").update(candidate, "utf8").digest();
  const hb = createHash("sha256").update(configured, "utf8").digest();
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const m = /^Bearer\s+(\S+)/i.exec(authorization.trim());
  return m?.[1]?.trim() ?? null;
}

export function parseAdminKeyFromJsonBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const ak = (body as Record<string, unknown>).adminKey;
  if (typeof ak !== "string") return undefined;
  const t = ak.trim();
  return t ? t : undefined;
}

export type ExtractFiAdminKeyFromRequestPartsOpts = {
  urlSearchParams: URLSearchParams;
  headers: { get(name: string): string | null };
  body?: unknown;
  configuredApiKey: string | undefined | null;
  env?: FiAdminKeyTransportEnv;
};

/**
 * Precedence: `x-fi-admin-key` → `Authorization: Bearer` (only if token equals configured key, timing-safe)
 * → `?adminKey=` (only if {@link isAdminKeyQueryAllowed}) → JSON `adminKey`.
 */
export function extractFiAdminKeyFromRequestParts(
  opts: ExtractFiAdminKeyFromRequestPartsOpts
): string | undefined {
  const env = opts.env ?? process.env;
  const configured = opts.configuredApiKey?.trim();

  const headerVal = opts.headers.get("x-fi-admin-key")?.trim();
  if (headerVal) return headerVal;

  const bearer = parseBearerToken(opts.headers.get("authorization"));
  if (bearer && configured && safeTimingEqualAdminKey(bearer, configured)) {
    return bearer;
  }

  if (isAdminKeyQueryAllowed(env)) {
    const q = opts.urlSearchParams.get("adminKey")?.trim();
    if (q) return q;
  }

  return parseAdminKeyFromJsonBody(opts.body);
}
