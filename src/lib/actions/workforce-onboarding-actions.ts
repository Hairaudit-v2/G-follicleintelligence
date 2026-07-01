"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";
import { markOnboardingTrainingComplete } from "@/src/lib/workforce/onboarding/onboardingChecklist.server";
import { sendOnboardingInvite } from "@/src/lib/workforce/onboarding/onboardingInvitation.server";
import {
  createOnboardingStaffMember,
  expireStaleOnboardingInvitations,
} from "@/src/lib/workforce/onboarding/onboardingPage.server";
import {
  ONBOARDING_EMPLOYMENT_TYPES,
  type OnboardingEmploymentType,
} from "@/src/lib/workforce/onboarding/onboardingTypes";
import { completeOnboardingPinSetup } from "@/src/lib/workforce/onboarding/onboardingPinLayer.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateOnboardingSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  const paths = [
    `/fi-admin/${tid}/hr-os/onboarding`,
    `/fi-admin/${tid}/hr-os`,
    `/fi-admin/${tid}/workforce-os`,
    `/fi-admin/${tid}/staff`,
  ];
  for (const p of paths) revalidatePath(p);
}

const createStaffSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("A valid email is required."),
  roleCode: z.string().trim().min(1, "Role is required."),
  clinicId: z.string().uuid().nullable().optional(),
  employmentType: z.enum(ONBOARDING_EMPLOYMENT_TYPES),
});

export async function createOnboardingStaffAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; staffMemberId: string } | { ok: false; error: string }> {
  try {
    const parsed = createStaffSchema.parse(body);
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    const result = await createOnboardingStaffMember({
      tenantId,
      data: {
        fullName: parsed.fullName,
        email: parsed.email,
        roleCode: parsed.roleCode,
        clinicId: parsed.clinicId ?? null,
        employmentType: parsed.employmentType as OnboardingEmploymentType,
      },
      actorFiUserId: fiUserId,
    });
    revalidateOnboardingSurfaces(tenantId);
    return { ok: true, staffMemberId: result.staffMemberId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function sendOnboardingInviteAction(
  tenantId: string,
  staffMemberId: string
): Promise<
  | { ok: true; inviteUrl: string; emailSent: boolean }
  | { ok: false; error: string }
> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    await expireStaleOnboardingInvitations(tenantId);
    const result = await sendOnboardingInvite({
      tenantId,
      staffMemberId,
      invitedBy: fiUserId,
    });
    revalidateOnboardingSurfaces(tenantId);
    return { ok: true, inviteUrl: result.inviteUrl, emailSent: result.emailSent };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function markOnboardingTrainingCompleteAction(
  tenantId: string,
  staffMemberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    await markOnboardingTrainingComplete({ tenantId, staffMemberId });
    revalidateOnboardingSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const pinSetupSchema = z.object({
  setupToken: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
  inviteToken: z.string().uuid().optional(),
});

/** Public onboarding PIN setup — token-gated, no admin session required. */
export async function completeOnboardingPinSetupAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = pinSetupSchema.parse(body);
    await completeOnboardingPinSetup({
      tenantId,
      setupToken: parsed.setupToken,
      pin: parsed.pin,
      inviteToken: parsed.inviteToken ?? null,
    });
    revalidateOnboardingSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function acceptOnboardingInviteAction(
  tenantId: string,
  inviteToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { acceptOnboardingInvitation } = await import(
      "@/src/lib/workforce/onboarding/onboardingInvitation.server"
    );
    await acceptOnboardingInvitation({ tenantId, inviteToken });
    revalidateOnboardingSurfaces(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
