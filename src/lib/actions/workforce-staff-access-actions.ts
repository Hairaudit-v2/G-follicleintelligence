"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";
import {
  copyStaffLoginInviteLink,
  resendStaffLoginInvite,
  revokeStaffLoginAccess,
  sendStaffLoginInvite,
  suspendStaffLoginAccess,
} from "@/src/lib/workforce/staffAccessCentre.server";
import { acceptStaffAccessInvitation } from "@/src/lib/workforce/staffAccessAccept.server";
import {
  completeStaffAccessPinSetup,
  requestStaffPinResetLink,
} from "@/src/lib/workforce/staffAccessPinLayer.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateStaffAccessSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  const paths = [
    `/fi-admin/${tid}/workforce-os/staff-access`,
    `/fi-admin/${tid}/workforce-os/directory`,
    `/fi-admin/${tid}/workforce-os`,
    `/fi-admin/${tid}/workforce-os/staff`,
    `/fi-admin/${tid}/staff`,
    `/fi-admin/${tid}/hr-os/onboarding`,
  ];
  for (const p of paths) revalidatePath(p, "layout");
}

const staffMemberBodySchema = z.object({
  staffMemberId: z.string().uuid(),
});

export type StaffAccessActionResult =
  | { ok: true; inviteUrl?: string; emailSent?: boolean; warning?: string | null }
  | { ok: false; error: string };

export async function sendStaffLoginInviteAction(
  tenantId: string,
  body: unknown
): Promise<StaffAccessActionResult> {
  try {
    const parsed = staffMemberBodySchema.parse(body);
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    const result = await sendStaffLoginInvite({
      tenantId,
      staffMemberId: parsed.staffMemberId,
      invitedBy: fiUserId,
    });
    revalidateStaffAccessSurfaces(tenantId);
    return {
      ok: true,
      inviteUrl: result.inviteUrl,
      emailSent: result.emailSent,
      warning: result.crossTenantWarning,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resendStaffLoginInviteAction(
  tenantId: string,
  body: unknown
): Promise<StaffAccessActionResult> {
  try {
    const parsed = staffMemberBodySchema.parse(body);
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    const result = await resendStaffLoginInvite({
      tenantId,
      staffMemberId: parsed.staffMemberId,
      invitedBy: fiUserId,
    });
    revalidateStaffAccessSurfaces(tenantId);
    return {
      ok: true,
      inviteUrl: result.inviteUrl,
      emailSent: result.emailSent,
      warning: result.crossTenantWarning,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function copyStaffLoginInviteLinkAction(
  tenantId: string,
  body: unknown
): Promise<StaffAccessActionResult> {
  try {
    const parsed = staffMemberBodySchema.parse(body);
    await assertWorkforceHrManageAllowed(tenantId);
    const result = await copyStaffLoginInviteLink({
      tenantId,
      staffMemberId: parsed.staffMemberId,
    });
    return { ok: true, inviteUrl: result.inviteUrl };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function revokeStaffLoginAccessAction(
  tenantId: string,
  body: unknown
): Promise<StaffAccessActionResult> {
  try {
    const parsed = staffMemberBodySchema.parse(body);
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    await revokeStaffLoginAccess({
      tenantId,
      staffMemberId: parsed.staffMemberId,
      actorFiUserId: fiUserId,
    });
    revalidateStaffAccessSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function suspendStaffLoginAccessAction(
  tenantId: string,
  body: unknown
): Promise<StaffAccessActionResult> {
  try {
    const parsed = staffMemberBodySchema.parse(body);
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    await suspendStaffLoginAccess({
      tenantId,
      staffMemberId: parsed.staffMemberId,
      actorFiUserId: fiUserId,
    });
    revalidateStaffAccessSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const acceptInviteSchema = z.object({
  inviteToken: z.string().uuid(),
  pinSetupToken: z.string().uuid().nullable().optional(),
});

/** Public — staff accept invite without admin session. */
export async function acceptStaffAccessInviteAction(
  tenantId: string,
  body: unknown
): Promise<StaffAccessActionResult> {
  try {
    const parsed = acceptInviteSchema.parse(body);
    await acceptStaffAccessInvitation({
      tenantId,
      inviteToken: parsed.inviteToken,
      pinSetupToken: parsed.pinSetupToken ?? null,
    });
    revalidateStaffAccessSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const pinSetupSchema = z.object({
  setupToken: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
});

/** Public — staff PIN setup from invite or reset link without admin session. */
export async function completeStaffAccessPinSetupAction(
  tenantId: string,
  body: unknown
): Promise<StaffAccessActionResult> {
  try {
    const parsed = pinSetupSchema.parse(body);
    await completeStaffAccessPinSetup({
      tenantId,
      setupToken: parsed.setupToken,
      pin: parsed.pin,
    });
    revalidateStaffAccessSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Admin creates a PIN reset link — admin never sees the PIN. */
export async function requestStaffPinResetLinkAction(
  tenantId: string,
  body: unknown
): Promise<StaffAccessActionResult> {
  try {
    const parsed = staffMemberBodySchema.parse(body);
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    const result = await requestStaffPinResetLink({
      tenantId,
      staffMemberId: parsed.staffMemberId,
      actorFiUserId: fiUserId,
    });
    revalidateStaffAccessSurfaces(tenantId);
    return { ok: true, inviteUrl: result.setupUrl };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
