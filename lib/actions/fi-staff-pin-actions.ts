"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { z } from "zod";

import { assertCrmTenantStaffManageAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { getFiTenantMemberSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import {
  disableStaffPinForTenant,
  loadStaffPinMetadataForStaff,
  setStaffPinForTenant,
} from "@/src/lib/staffPin/staffPin.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";
import { assertStaffPinFormat, staffPinsMatch } from "@/src/lib/staffPin/staffPinValidation";

const pinBodySchema = z.object({
  adminKey: z.string().optional(),
  newPin: z.string(),
  confirmPin: z.string(),
});

const staffIdBodySchema = z.object({
  adminKey: z.string().optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function loadStaffPinStatusAction(
  tenantId: string,
  staffId: string,
  body: unknown = {}
): Promise<
  | { ok: true; metadata: Awaited<ReturnType<typeof loadStaffPinMetadataForStaff>> }
  | { ok: false; error: string }
> {
  try {
    const parsed = staffIdBodySchema.parse(body ?? {});
    await rejectStaffPinSessionForRestrictedMutation(tenantId.trim());
    await assertCrmTenantStaffManageAllowed({
      tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const metadata = await loadStaffPinMetadataForStaff(tenantId.trim(), staffId.trim());
    return { ok: true, metadata };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function setStaffPinAction(
  tenantId: string,
  staffId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = pinBodySchema.parse(body);
    await rejectStaffPinSessionForRestrictedMutation(tenantId.trim());
    await assertCrmTenantStaffManageAllowed({
      tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const actor = await getFiTenantMemberSessionIfAllowed(tenantId.trim());
    assertStaffPinFormat(parsed.newPin);
    if (!staffPinsMatch(parsed.newPin, parsed.confirmPin)) {
      return { ok: false, error: "PIN confirmation does not match." };
    }

    await setStaffPinForTenant({
      tenantId: tenantId.trim(),
      staffId: staffId.trim(),
      pin: parsed.newPin,
      actorFiUserId: actor?.fiUserId ?? null,
      reset: false,
    });

    revalidateStaffPinSurfaces(tenantId.trim());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function resetStaffPinAction(
  tenantId: string,
  staffId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = pinBodySchema.parse(body);
    await rejectStaffPinSessionForRestrictedMutation(tenantId.trim());
    await assertCrmTenantStaffManageAllowed({
      tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const actor = await getFiTenantMemberSessionIfAllowed(tenantId.trim());
    assertStaffPinFormat(parsed.newPin);
    if (!staffPinsMatch(parsed.newPin, parsed.confirmPin)) {
      return { ok: false, error: "PIN confirmation does not match." };
    }

    await setStaffPinForTenant({
      tenantId: tenantId.trim(),
      staffId: staffId.trim(),
      pin: parsed.newPin,
      actorFiUserId: actor?.fiUserId ?? null,
      reset: true,
    });

    revalidateStaffPinSurfaces(tenantId.trim());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function disableStaffPinAction(
  tenantId: string,
  staffId: string,
  body: unknown = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = staffIdBodySchema.parse(body ?? {});
    await rejectStaffPinSessionForRestrictedMutation(tenantId.trim());
    await assertCrmTenantStaffManageAllowed({
      tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const actor = await getFiTenantMemberSessionIfAllowed(tenantId.trim());

    await disableStaffPinForTenant({
      tenantId: tenantId.trim(),
      staffId: staffId.trim(),
      actorFiUserId: actor?.fiUserId ?? null,
    });

    revalidateStaffPinSurfaces(tenantId.trim());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function staffPinLogoutAction(
  tenantId: string
): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  try {
    const member = await getFiTenantMemberSessionIfAllowed(tenantId);
    const { clearStaffPinClinicSessionCookie } =
      await import("@/src/lib/staffPin/staffPinSession.server");
    await clearStaffPinClinicSessionCookie();
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    return {
      ok: true,
      redirectTo: member ? `/fi-admin/${tid}/calendar` : `/fi-admin/${tid}/staff-pin-login`,
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

function revalidateStaffPinSurfaces(tenantId: string): void {
  revalidatePath(`/fi-admin/${tenantId}/staff`);
  revalidatePath(`/fi-admin/${tenantId}/staff-pin-login`);
}
