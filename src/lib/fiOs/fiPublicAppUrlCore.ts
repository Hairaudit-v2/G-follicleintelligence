/**
 * Canonical public origin for FI OS external links (staff invites, PIN setup, etc.).
 * Never uses VERCEL_URL or preview deployment hosts for staff-facing links.
 */

import { normalizeFiDeploymentBaseUrl } from "@/src/lib/env/fiDeploymentBaseUrl";

export const FI_PUBLIC_APP_URL_MISSING_MESSAGE =
  "Public app URL is not configured. Set FI_PUBLIC_APP_URL to generate staff invite links.";

const VERCEL_PREVIEW_HOST_RE = /\.vercel\.app$/i;

function stripTrailingSlashes(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function parseHostname(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True for Vercel preview deployment hosts (*.vercel.app). */
export function isVercelPreviewDeploymentHost(raw: string): boolean {
  const hostname = parseHostname(raw);
  return Boolean(hostname && VERCEL_PREVIEW_HOST_RE.test(hostname));
}

function isLocalhostHost(raw: string): boolean {
  const hostname = parseHostname(raw);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function readConfiguredPublicAppUrl(): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_FI_PUBLIC_APP_URL,
    process.env.FI_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.FI_BASE_URL,
  ];

  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    const normalized = normalizeFiDeploymentBaseUrl(stripTrailingSlashes(trimmed));
    if (!normalized) continue;
    if (isVercelPreviewDeploymentHost(normalized)) continue;
    return normalized;
  }

  return null;
}

function isDevOrTestRuntime(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

/**
 * Resolves the canonical public FI OS origin for external links.
 * Returns null in production when no trusted env var is configured.
 */
export function resolveFiPublicAppUrl(options?: {
  /** Local development only — never used for staff invite links in production. */
  allowRequestOrigin?: string | null;
}): string | null {
  const configured = readConfiguredPublicAppUrl();
  if (configured) return configured;

  if (isDevOrTestRuntime()) {
    const requestOrigin = options?.allowRequestOrigin?.trim();
    if (requestOrigin) {
      const normalized = normalizeFiDeploymentBaseUrl(stripTrailingSlashes(requestOrigin));
      if (normalized && !isVercelPreviewDeploymentHost(normalized) && isLocalhostHost(normalized)) {
        return normalized;
      }
    }
    return "http://localhost:3000";
  }

  return null;
}

/** Required for staff-facing external links; throws when production config is missing. */
export function requireFiPublicAppUrlForExternalLinks(): string {
  const url = resolveFiPublicAppUrl();
  if (url) return url;
  throw new Error(FI_PUBLIC_APP_URL_MISSING_MESSAGE);
}

export function buildFiPublicAppUrl(pathname: string): string {
  const base = requireFiPublicAppUrlForExternalLinks();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}`;
}
