/**
 * Unified staff lifecycle UX — pure presentation and action resolution for WorkforceOS.
 * Consumes existing access/onboarding core types; no server or database imports.
 */

import {
  canCopyOnboardingInviteLink,
  canResendOnboardingInvite,
  canSendOnboardingInvite,
  type OnboardingInviteDisplayStatus,
} from "@/src/lib/workforce/onboarding/onboardingCentreCore";
import {
  authLoginStatusLabel,
  inviteStatusLabel,
  pinStatusLabel,
  type StaffAuthLoginStatus,
  type StaffInviteStatus,
} from "@/src/lib/team/access/staffAccessCentreCore";
import { resolveStaffLifecycleOperationalState } from "@/src/lib/team/identity/staffLifecyclePresentation";
import type { StaffMemberLifecycleRow } from "@/src/lib/team/identity/staffLifecycleTypes";

export type StaffLifecycleSurface = "directory" | "profile" | "access_centre" | "command_centre";

export type StaffLifecycleActionId =
  | "start_onboarding"
  | "send_onboarding_invite"
  | "resend_onboarding_invite"
  | "copy_onboarding_invite_link"
  | "send_login_invite"
  | "resend_login_invite"
  | "copy_login_invite_link"
  | "reset_pin"
  | "assign_training"
  | "upload_document"
  | "manager_approval"
  | "suspend_access"
  | "revoke_access"
  | "open_access_centre"
  | "open_onboarding_centre"
  | "open_identity_audit"
  | "open_roster"
  | "open_command_centre"
  | "open_documents"
  | "view_profile";

export type StaffLifecycleAction = {
  id: StaffLifecycleActionId;
  label: string;
  /** When set, action is informational only (e.g. suspended staff). */
  guidance?: string;
  href?: string;
  priority: "primary" | "secondary" | "destructive";
};

export type StaffUnifiedStatusSnapshot = {
  employmentLabel: string;
  operationalState: ReturnType<typeof resolveStaffLifecycleOperationalState>;
  operationalLabel: string;
  onboardingInviteStatus: OnboardingInviteDisplayStatus | null;
  loginStatus: StaffAuthLoginStatus | null;
  loginLabel: string | null;
  inviteStatus: StaffInviteStatus | null;
  inviteLabel: string | null;
  pinLabel: string | null;
  readinessScore: number | null;
  readinessLabel: string | null;
  complianceLabel: string | null;
  isAccessSuspended: boolean;
  isOnboardingComplete: boolean;
};

// A2: onboarding and staff access retired into /team tabs — link to the
// canonical paths rather than bouncing through a redirect.
export function buildStaffOnboardingCentreHref(tenantBase: string): string {
  return `${tenantBase.replace(/\/$/, "")}/team/onboarding`;
}

export function buildStaffAccessCentreHref(tenantBase: string): string {
  return `${tenantBase.replace(/\/$/, "")}/team/identity`;
}

export function buildStaffDirectoryPrimaryActionHref(tenantBase: string): string {
  return buildStaffOnboardingCentreHref(tenantBase);
}

export function buildStaffProfileHrefFromBase(tenantBase: string, staffId: string): string {
  return `${tenantBase.replace(/\/$/, "")}/workforce-os/staff/${staffId.trim()}`;
}

export function formatReadinessScoreLabel(score: number | null | undefined): string | null {
  if (score == null || Number.isNaN(score)) return null;
  return `Readiness ${Math.round(score)}%`;
}

export function resolveStaffUnifiedStatus(input: {
  employmentStatus: string | null | undefined;
  archivedAt: string | null | undefined;
  systemAccessRevoked: boolean;
  onboardingInviteStatus?: OnboardingInviteDisplayStatus | null;
  authLoginStatus?: StaffAuthLoginStatus | null;
  inviteStatus?: StaffInviteStatus | null;
  pinStatus?: string | null;
  readinessScore?: number | null;
  complianceLabel?: string | null;
  onboardingChecklistComplete?: boolean;
}): StaffUnifiedStatusSnapshot {
  const operationalState = resolveStaffLifecycleOperationalState({
    employment_status: String(
      input.employmentStatus ?? "active"
    ) as StaffMemberLifecycleRow["employment_status"],
    archived_at: input.archivedAt ?? null,
  });

  const employment = String(input.employmentStatus ?? "active").trim();
  const employmentLabel = employment.replace(/_/g, " ");

  return {
    employmentLabel: employmentLabel.charAt(0).toUpperCase() + employmentLabel.slice(1),
    operationalState,
    operationalLabel: operationalState.replace(/_/g, " "),
    onboardingInviteStatus: input.onboardingInviteStatus ?? null,
    loginStatus: input.authLoginStatus ?? null,
    loginLabel: input.authLoginStatus ? authLoginStatusLabel(input.authLoginStatus) : null,
    inviteStatus: input.inviteStatus ?? null,
    inviteLabel: input.inviteStatus ? inviteStatusLabel(input.inviteStatus) : null,
    pinLabel: input.pinStatus != null ? pinStatusLabel(input.pinStatus) : null,
    readinessScore: input.readinessScore ?? null,
    readinessLabel: formatReadinessScoreLabel(input.readinessScore),
    complianceLabel: input.complianceLabel ?? null,
    isAccessSuspended:
      input.systemAccessRevoked ||
      input.authLoginStatus === "suspended" ||
      input.authLoginStatus === "revoked" ||
      String(input.employmentStatus ?? "")
        .trim()
        .toLowerCase() === "suspended",
    isOnboardingComplete: Boolean(input.onboardingChecklistComplete),
  };
}

export function resolveOnboardingCentreActions(input: {
  email: string | null | undefined;
  systemAccessRevoked: boolean;
  employmentStatus: string | null | undefined;
  inviteStatus: OnboardingInviteDisplayStatus;
  hasInviteUrl: boolean;
}): StaffLifecycleAction[] {
  const actions: StaffLifecycleAction[] = [];

  if (
    input.systemAccessRevoked ||
    String(input.employmentStatus ?? "")
      .trim()
      .toLowerCase() === "suspended"
  ) {
    actions.push({
      id: "open_access_centre",
      label: "Manage access in Staff Access",
      guidance:
        "Access is suspended. Reactivate or review suspension in Staff Access before sending invites.",
      priority: "primary",
    });
    return actions;
  }

  if (canSendOnboardingInvite(input)) {
    actions.push({
      id: "send_onboarding_invite",
      label: "Send invite",
      priority: "primary",
    });
  }
  if (canResendOnboardingInvite(input)) {
    actions.push({
      id: "resend_onboarding_invite",
      label: "Resend invite",
      priority: "primary",
    });
  }
  if (canCopyOnboardingInviteLink(input)) {
    actions.push({
      id: "copy_onboarding_invite_link",
      label: "Copy invite link",
      priority: "secondary",
    });
  }

  return actions;
}

export function resolveStaffAccessCentreActions(input: {
  canSendInvite: boolean;
  canResendInvite: boolean;
  canCopyInviteLink: boolean;
  canResetPin: boolean;
  canSuspendAccess: boolean;
  canRevokeAccess: boolean;
  authLoginStatus: StaffAuthLoginStatus;
  systemAccessRevoked: boolean;
}): StaffLifecycleAction[] {
  const actions: StaffLifecycleAction[] = [];

  if (
    input.authLoginStatus === "suspended" ||
    input.authLoginStatus === "revoked" ||
    input.systemAccessRevoked
  ) {
    actions.push({
      id: "open_access_centre",
      label: "Review access status",
      guidance:
        "Staff access is suspended or revoked. Use Staff Access to review reactivation steps — do not resend onboarding invites.",
      priority: "primary",
    });
    if (input.canRevokeAccess && input.authLoginStatus !== "revoked") {
      actions.push({ id: "revoke_access", label: "Revoke access", priority: "destructive" });
    }
    return actions;
  }

  if (input.canSendInvite) {
    actions.push({ id: "send_login_invite", label: "Send invite", priority: "primary" });
  }
  if (input.canResendInvite) {
    actions.push({ id: "resend_login_invite", label: "Resend invite", priority: "primary" });
  }
  if (input.canCopyInviteLink) {
    actions.push({ id: "copy_login_invite_link", label: "Copy link", priority: "secondary" });
  }
  if (input.canResetPin) {
    actions.push({ id: "reset_pin", label: "Reset PIN", priority: "secondary" });
  }
  if (input.canSuspendAccess) {
    actions.push({ id: "suspend_access", label: "Suspend", priority: "destructive" });
  }
  if (input.canRevokeAccess) {
    actions.push({ id: "revoke_access", label: "Revoke", priority: "destructive" });
  }

  return actions;
}

/** Directory-level primary CTA when no staff exist or manager wants to add someone. */
export function staffDirectoryLifecycleGuidance(): {
  headline: string;
  body: string;
  emptyState: string;
} {
  return {
    headline: "One staff member · one lifecycle",
    body: "New staff start in Onboarding. Access is managed in Staff Access. Readiness combines documents, training, SOPs, permissions, identity, and roster eligibility.",
    emptyState: "No staff records yet. New staff start in Onboarding Centre.",
  };
}
