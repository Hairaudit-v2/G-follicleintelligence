/**
 * Pure logic for WorkforceOS Staff Access Centre — no database or server-only imports.
 */

import { STAFF_ROLE_LABELS, type StaffRoleKey } from "@/src/lib/staffAccess/staffAccessRegistry";

export type StaffAuthLoginStatus =
  | "login_active"
  | "invite_pending"
  | "no_login"
  | "suspended"
  | "revoked";

export type StaffInviteStatus = "none" | "pending" | "accepted" | "expired" | "revoked";

/** Employment statuses that block login invite provisioning. */
export const DEPARTED_EMPLOYMENT_STATUSES = new Set([
  "terminated",
  "resigned",
  "contract_ended",
  "contract_expired",
  "merged",
]);

export const STAFF_LOGIN_INVITE_EXPIRY_DAYS = 14;

export function isArchivedStaff(archivedAt: string | null | undefined): boolean {
  return Boolean(archivedAt?.trim());
}

export function isDepartedStaff(employmentStatus: string | null | undefined): boolean {
  const status = String(employmentStatus ?? "").trim().toLowerCase();
  return DEPARTED_EMPLOYMENT_STATUSES.has(status);
}

export function resolvePermissionTemplateLabel(roleCode: string | null | undefined): string {
  const key = String(roleCode ?? "").trim().toLowerCase();
  if (!key) return "—";
  const label = STAFF_ROLE_LABELS[key as StaffRoleKey];
  return label ?? key.replace(/_/g, " ");
}

export function resolveAuthLoginStatus(input: {
  systemAccessRevoked: boolean;
  employmentStatus: string | null | undefined;
  fiUserId: string | null | undefined;
  authUserId: string | null | undefined;
  authEmailConfirmed: boolean;
  authHasSignedIn: boolean;
}): StaffAuthLoginStatus {
  if (input.systemAccessRevoked) return "revoked";
  if (String(input.employmentStatus ?? "").trim().toLowerCase() === "suspended") {
    return "suspended";
  }
  if (input.authEmailConfirmed || input.authHasSignedIn) return "login_active";
  if (input.fiUserId?.trim() && input.authUserId?.trim()) return "invite_pending";
  return "no_login";
}

export function resolveInviteStatus(input: {
  invitationStatus: string | null | undefined;
  expiresAt: string | null | undefined;
  now?: Date;
}): StaffInviteStatus {
  const raw = String(input.invitationStatus ?? "").trim().toLowerCase();
  if (!raw) return "none";
  if (raw === "accepted") return "accepted";
  if (raw === "revoked") return "revoked";
  if (raw === "expired") return "expired";
  const expiresAt = input.expiresAt?.trim();
  if (expiresAt) {
    const now = input.now ?? new Date();
    if (new Date(expiresAt).getTime() < now.getTime()) return "expired";
  }
  if (raw === "pending") return "pending";
  return "none";
}

export function canReceiveLoginInvite(input: {
  archivedAt: string | null | undefined;
  employmentStatus: string | null | undefined;
  email: string | null | undefined;
  systemAccessRevoked: boolean;
  authLoginStatus: StaffAuthLoginStatus;
}): boolean {
  if (isArchivedStaff(input.archivedAt)) return false;
  if (isDepartedStaff(input.employmentStatus)) return false;
  if (input.systemAccessRevoked) return false;
  if (!String(input.email ?? "").trim()) return false;
  if (input.authLoginStatus === "login_active") return false;
  if (input.authLoginStatus === "suspended" || input.authLoginStatus === "revoked") return false;
  return true;
}

export function authLoginStatusLabel(status: StaffAuthLoginStatus): string {
  if (status === "login_active") return "Login Active";
  if (status === "invite_pending") return "Invite Pending";
  if (status === "suspended") return "Suspended";
  if (status === "revoked") return "Revoked";
  return "No Login";
}

export function inviteStatusLabel(status: StaffInviteStatus): string {
  if (status === "pending") return "Invite Pending";
  if (status === "accepted") return "Invite Accepted";
  if (status === "expired") return "Invite Expired";
  if (status === "revoked") return "Invite Revoked";
  return "No Invite";
}

export function pinStatusLabel(status: string | null | undefined): string {
  const s = String(status ?? "not_set").trim().toLowerCase();
  if (s === "active") return "PIN Active";
  if (s === "locked") return "PIN Locked";
  if (s === "disabled") return "PIN Disabled";
  return "PIN Not Set";
}

/** Resend should advance invited_at while preserving invitation identity when possible. */
export function nextResendInvitationTimestamps(
  now: Date = new Date()
): { invitedAt: string; expiresAt: string; updatedAt: string } {
  const invitedAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + STAFF_LOGIN_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  return { invitedAt, expiresAt, updatedAt: invitedAt };
}
