"use server";

import { revalidatePath } from "next/cache";

import { assertStaffFeatureAccessMutationAllowed } from "@/src/lib/fi-os/featureAccess.server";
import { updateFiStaff } from "@/src/lib/staff/staff.server";

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

/** Clears structured position when `positionTypeId` is empty string or null. */
export async function saveStaffPositionTypeAction(
  tenantId: string,
  staffId: string,
  positionTypeId: string | null,
  adminKey?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tid = tenantId.trim();
    const sid = staffId.trim();
    if (!tid || !sid) return { ok: false, error: "Missing tenant or staff id." };
    await assertStaffFeatureAccessMutationAllowed({ tenantId: tid, adminKey: adminKey ?? undefined });
    const normalized = positionTypeId?.trim() || null;
    await updateFiStaff(tid, sid, { position_type_id: normalized });
    revalidatePath(`/fi-admin/${tid}/staff`);
    revalidatePath(`/fi-admin/${tid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
