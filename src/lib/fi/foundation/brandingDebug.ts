/**
 * FI-BRANDING-SYSTEM-1C — temporary debug instrumentation for the branding
 * save/load path. Enabled outside production, or in production when
 * FI_BRANDING_DEBUG=1 is set. Remove once the live save issue is closed.
 */

export function brandingDebugEnabled(): boolean {
  if (process.env.FI_BRANDING_DEBUG === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export function logBrandingDebug(step: string, detail: Record<string, unknown>): void {
  if (!brandingDebugEnabled()) return;
  try {
    console.log(`[fi-branding-debug] ${step}`, JSON.stringify(detail));
  } catch {
    console.log(`[fi-branding-debug] ${step}`, detail);
  }
}
