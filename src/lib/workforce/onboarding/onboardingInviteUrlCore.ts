/** Pure helpers for staff onboarding (no server-only imports). */

export function buildOnboardingInviteUrl(tenantId: string, token: string): string {
  const fromPublic = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const fromVercel = process.env.VERCEL_URL?.trim()
    ? `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`
    : null;
  const base = fromPublic || fromVercel || "http://localhost:3000";
  return `${base}/fi-admin/${tenantId.trim()}/onboarding/invite/${token.trim()}`;
}
