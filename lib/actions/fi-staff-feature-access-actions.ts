"use server";

import { revalidatePath } from "next/cache";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isFiFeatureKey, type FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import {
  assertStaffFeatureAccessMutationAllowed,
  persistStaffFeatureAccessPatch,
} from "@/src/lib/fi-os/featureAccess.server";

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function saveStaffFeatureAccessPatchAction(
  tenantId: string,
  staffId: string,
  patch: Record<string, boolean>,
  adminKey?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tid = tenantId.trim();
    const sid = staffId.trim();
    if (!tid || !sid) return { ok: false, error: "Missing tenant or staff id." };
    await assertStaffFeatureAccessMutationAllowed({ tenantId: tid, adminKey: adminKey ?? undefined });
    const normalized: Partial<Record<FiFeatureKey, boolean>> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (!isFiFeatureKey(k)) continue;
      normalized[k] = Boolean(v);
    }
    const editor = await resolveAuthUserId(null);
    await persistStaffFeatureAccessPatch({
      tenantId: tid,
      staffId: sid,
      patch: normalized,
      editorAuthUserId: editor,
    });
    revalidatePath(`/fi-admin/${tid}/staff`);
    revalidatePath(`/fi-admin/${tid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
