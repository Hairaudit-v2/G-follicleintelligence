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
    `/fi-admin/${tid}/staff`,
    `/fi-admin/${tid}/hr-os/onboarding`,
  ];
  for (const p of paths) revalidatePath(p);
}

const staffMemberBodySchema = z.object({
  staffMemberId: z.string().uuid(),
});

export type StaffAccessActionResult =
  | { ok: true; inviteUrl?: string; emailSent?: boolean }
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
    return { ok: true, inviteUrl: result.inviteUrl, emailSent: result.emailSent };
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
    return { ok: true, inviteUrl: result.inviteUrl, emailSent: result.emailSent };
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
