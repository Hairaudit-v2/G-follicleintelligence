/** Pure helpers for staff onboarding (no server-only imports). */

import {
  buildFiPublicAppUrl,
  resolveFiPublicAppUrl,
} from "@/src/lib/fiOs/fiPublicAppUrlCore";

export function buildOnboardingInviteUrl(tenantId: string, token: string): string {
  return buildFiPublicAppUrl(
    `/fi-admin/${tenantId.trim()}/onboarding/invite/${token.trim()}`
  );
}

/** Non-throwing helper for read-only UI surfaces when public URL is not configured. */
export function tryBuildOnboardingInviteUrl(tenantId: string, token: string): string | null {
  const base = resolveFiPublicAppUrl();
  if (!base) return null;
  return `${base}/fi-admin/${tenantId.trim()}/onboarding/invite/${token.trim()}`;
}
