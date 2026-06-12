/**
 * Explicit opt-in for `checkFiTenantPortalApiAccess` to skip session checks (local / locked-down staging only).
 * **Never** true when `NODE_ENV === "production"` — previews and prod always require normal session behaviour.
 */
export type InsecureFiApiBypassEnv = Record<string, string | undefined>;

const AFFIRMATIVE = new Set(["1", "true", "yes"]);

/**
 * Returns true only when not in production runtime and `FI_ALLOW_INSECURE_API` is exactly `true` / `1` / `yes` (trimmed, case-insensitive).
 */
export function isInsecureFiApiBypassAllowed(env: InsecureFiApiBypassEnv = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  const raw = env.FI_ALLOW_INSECURE_API;
  if (raw === undefined || raw === "") return false;
  return AFFIRMATIVE.has(raw.trim().toLowerCase());
}
