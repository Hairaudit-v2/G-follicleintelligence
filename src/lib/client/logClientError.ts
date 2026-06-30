"use client";

import { logStructured } from "@/src/lib/server/structuredLog";

/**
 * Emit a single-line JSON error event from client error boundaries (Vercel log drain).
 * Never pass user-identifying or PHI fields.
 */
export function logClientError(
  surface: string,
  error: Error & { digest?: string },
  extra?: Record<string, string | number | boolean | null | undefined>
): void {
  logStructured("error", "client_error_boundary", {
    surface,
    message: error.message?.slice(0, 500) ?? "unknown",
    digest: error.digest ?? null,
    name: error.name ?? "Error",
    ...extra,
  });
}
