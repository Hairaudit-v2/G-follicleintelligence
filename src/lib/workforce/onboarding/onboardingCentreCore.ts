/**
 * Pure logic for Onboarding Centre invite actions — no database or server-only imports.
 */

export type OnboardingInviteDisplayStatus = "none" | "pending" | "accepted" | "expired" | "revoked";

export function mapOnboardingInviteDisplayStatus(input: {
  rawStatus: string | null | undefined;
  expiresAt: string | null | undefined;
  acceptedAt: string | null | undefined;
  now?: Date;
}): OnboardingInviteDisplayStatus {
  const raw = String(input.rawStatus ?? "").trim().toLowerCase();
  if (input.acceptedAt?.trim() || raw === "accepted") return "accepted";
  if (raw === "revoked") return "revoked";
  if (raw === "expired") return "expired";
  const expiresAt = input.expiresAt?.trim();
  if (expiresAt) {
    const now = input.now ?? new Date();
    if (new Date(expiresAt).getTime() < now.getTime()) return "expired";
  }
  if (raw === "pending" || raw === "sent" || raw === "") return "pending";
  return "none";
}

export function onboardingInviteStatusLabel(status: OnboardingInviteDisplayStatus): string {
  if (status === "accepted") return "Invite Accepted";
  if (status === "expired") return "Invite Expired";
  if (status === "revoked") return "Invite Revoked";
  if (status === "pending") return "Invite Pending";
  return "No Invite";
}

export function canSendOnboardingInvite(input: {
  email: string | null | undefined;
  systemAccessRevoked: boolean;
  employmentStatus: string | null | undefined;
  inviteStatus: OnboardingInviteDisplayStatus;
}): boolean {
  if (!String(input.email ?? "").trim()) return false;
  if (input.systemAccessRevoked) return false;
  if (String(input.employmentStatus ?? "").trim().toLowerCase() === "suspended") return false;
  if (input.inviteStatus === "accepted") return false;
  if (input.inviteStatus === "pending" || input.inviteStatus === "expired") return false;
  return input.inviteStatus === "none" || input.inviteStatus === "revoked";
}

export function canResendOnboardingInvite(input: {
  email: string | null | undefined;
  systemAccessRevoked: boolean;
  employmentStatus: string | null | undefined;
  inviteStatus: OnboardingInviteDisplayStatus;
}): boolean {
  if (!String(input.email ?? "").trim()) return false;
  if (input.systemAccessRevoked) return false;
  if (String(input.employmentStatus ?? "").trim().toLowerCase() === "suspended") return false;
  if (input.inviteStatus === "accepted") return false;
  return input.inviteStatus === "pending" || input.inviteStatus === "expired";
}

export function canCopyOnboardingInviteLink(input: {
  inviteStatus: OnboardingInviteDisplayStatus;
  hasInviteUrl: boolean;
}): boolean {
  return (
    (input.inviteStatus === "pending" || input.inviteStatus === "expired") &&
    input.hasInviteUrl
  );
}
