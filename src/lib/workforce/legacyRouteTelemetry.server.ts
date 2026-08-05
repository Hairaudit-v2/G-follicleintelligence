import "server-only";

import { headers } from "next/headers";

import { logStructured } from "@/src/lib/server/structuredLog";

/**
 * Phase A1 (workforce cohesion): legacy workforce surfaces stay live but are no
 * longer advertised in navigation. Every page load on one of them is logged so
 * Phase A2 can sequence redirects around real consumers (bookmarks, emails,
 * cross-module links) instead of guesses.
 *
 * Emits a single-line JSON log (see structuredLog) — no PII beyond tenant id
 * and coarse viewer role; never throws into page rendering.
 */
export type LegacyWorkforceSurface = "staff" | "workforce-os" | "hr-os" | "hr";

export async function logLegacyWorkforceRouteAccess(
  surface: LegacyWorkforceSurface,
  tenantId: string,
  opts?: { viewerRole?: string | null }
): Promise<void> {
  try {
    const h = await headers();
    // Best effort: middleware sets x-pathname in production; fall back to the surface prefix.
    const pathname = h.get("x-pathname") ?? h.get("x-invoke-path") ?? null;
    logStructured("info", "workforce_legacy_route_access", {
      surface,
      tenantId: tenantId.trim(),
      pathname,
      viewerRole: opts?.viewerRole ?? null,
    });
  } catch {
    // Telemetry must never break a legacy page load.
  }
}
