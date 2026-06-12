/**
 * FI admin API key comparison (timing-safe). Server / Node only — imports `node:crypto`.
 */
import { safeTimingEqualAdminKey } from "@/src/lib/crm/fiAdminKeyTransport";

/** Compare submitted admin key to configured `FI_ADMIN_API_KEY` (trimmed; timing-safe). */
export function isFiAdminApiKeyMatch(
  adminKey: string | undefined | null,
  configuredKey: string | undefined | null,
): boolean {
  const expected = configuredKey?.trim();
  if (!expected) return false;
  const candidate = adminKey?.trim();
  if (!candidate) return false;
  return safeTimingEqualAdminKey(candidate, expected);
}
