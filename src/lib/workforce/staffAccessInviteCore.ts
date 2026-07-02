/**
 * Pure helpers for Staff Access invite lifecycle — no server-only imports.
 */

import { createHash, randomUUID } from "node:crypto";

/** Default invite validity for Staff Access Centre (days). */
export const STAFF_ACCESS_INVITE_EXPIRY_DAYS = 7;

export const STAFF_ACCESS_INVITE_ERRORS = {
  ADMIN_ONLY: "Only admins can send staff access invites.",
  ALREADY_ACCEPTED: "This invite has already been accepted.",
  EXPIRED: "This invite has expired. Ask your clinic administrator to resend it.",
  NOT_ACTIVE: "This invite is no longer active. Ask your clinic administrator for a new invite.",
  NO_CLINIC_ACCESS: "You do not have access to this clinic.",
  SUSPENDED: "Your staff access has been suspended. Please contact your clinic administrator.",
  PIN_SELF_SERVICE:
    "You can set your PIN from a valid invite link or from your own staff account.",
  NOT_ELIGIBLE: "This staff member is not eligible for a login invite.",
  REVOKED_REACTIVATE:
    "Staff access was revoked or suspended. Reactivate access before sending a new invite.",
  ACCEPTED_NO_RESEND:
    "Invite already accepted. Use Reset PIN if the staff member forgot their clinic PIN.",
} as const;

export function generateStaffAccessInviteToken(): string {
  return randomUUID();
}

export function hashStaffAccessInviteToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

function staffAccessAppBaseUrl(): string {
  const fromPublic = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const fromVercel = process.env.VERCEL_URL?.trim()
    ? `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`
    : null;
  return fromPublic || fromVercel || "http://localhost:3000";
}

export function buildStaffAccessInviteUrl(tenantId: string, token: string): string {
  return `${staffAccessAppBaseUrl()}/fi-admin/${tenantId.trim()}/workforce-os/staff-access/accept/${token.trim()}`;
}

export function buildStaffAccessPinSetupUrl(tenantId: string, setupToken: string): string {
  return `${staffAccessAppBaseUrl()}/fi-admin/${tenantId.trim()}/workforce-os/staff-access/pin-setup/${setupToken.trim()}`;
}

export function buildStaffAccessInviteEmail(input: {
  staffFirstName: string;
  clinicOrTenantName: string;
  inviteLink: string;
  expiryDate: string;
}): { subject: string; text: string } {
  const name = input.staffFirstName.trim() || "there";
  const clinic = input.clinicOrTenantName.trim() || "your clinic";
  const subject = "You're invited to access Follicle Intelligence";
  const text = [
    `Hi ${name},`,
    "",
    `You've been invited to access Follicle Intelligence for ${clinic}.`,
    "",
    "Follicle Intelligence is the clinic operating system used for staff workflows, patient coordination, procedure-day activity, training, compliance, and secure role-based access.",
    "",
    "To activate your access, please use the secure link below:",
    "",
    input.inviteLink,
    "",
    `This link will expire on ${input.expiryDate}.`,
    "",
    "When you open the link, you'll be asked to:",
    "",
    "1. Confirm your staff access.",
    "2. Set your secure staff PIN.",
    "3. Complete any required onboarding steps assigned to your role.",
    "",
    "For security, please do not share this link with anyone.",
    "",
    "If the link has expired or you did not request access, please contact your clinic administrator.",
    "",
    "Thanks,",
    clinic,
    "",
    "---",
    `This invitation was sent from Follicle Intelligence on behalf of ${clinic}.`,
  ].join("\n");
  return { subject, text };
}

export function buildOnboardingInviteEmail(input: {
  staffFirstName: string;
  clinicOrTenantName: string;
  inviteLink: string;
  expiryDate: string;
}): { subject: string; text: string } {
  return buildStaffAccessInviteEmail(input);
}

export function staffAccessInviteExpiryIso(now: Date = new Date()): string {
  return new Date(
    now.getTime() + STAFF_ACCESS_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

export function formatInviteExpiryDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function extractStaffFirstName(fullName: string): string {
  const parts = String(fullName ?? "").trim().split(/\s+/);
  return parts[0] ?? "there";
}
