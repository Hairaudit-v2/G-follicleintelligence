/**
 * Pure hire-invite status helpers (onboarding domain).
 * Distinct from login-invite status in team/access — collision C9.
 */

import type { OnboardingInvitationStatus } from "@/src/lib/team/onboarding/onboardingTypes";

/**
 * Coerce raw invitation row status + expiry into the onboarding display/mutation status.
 * Revoked maps to expired for invitee-facing flows (existing behaviour).
 */
export function resolveOnboardingInvitationStatus(
  raw: unknown,
  expiresAt: string,
  now: Date = new Date()
): OnboardingInvitationStatus {
  const status = String(raw ?? "pending")
    .trim()
    .toLowerCase();
  if (status === "accepted") return "accepted";
  if (status === "revoked") return "expired";
  if (status === "expired" || new Date(expiresAt).getTime() < now.getTime()) return "expired";
  return "pending";
}
