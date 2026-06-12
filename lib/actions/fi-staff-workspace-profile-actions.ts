"use server";

import { revalidatePath } from "next/cache";

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { FI_WORKSPACE_PROFILE_ADMIN_DROPDOWN_KEYS } from "@/src/config/fiWorkspaceProfiles";
import {
  assertAssignableWorkspaceProfileKey,
  persistStaffWorkspaceProfileOverride,
} from "@/src/lib/fi-os/workspaceProfile.server";

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function saveStaffWorkspaceProfileAction(
  tenantId: string,
  staffId: string,
  profileKey: string,
  adminKey?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tid = tenantId.trim();
    const sid = staffId.trim();
    if (!tid || !sid) return { ok: false, error: "Missing tenant or staff id." };
    const normalized = assertAssignableWorkspaceProfileKey(profileKey);
    const allowed = new Set<string>(FI_WORKSPACE_PROFILE_ADMIN_DROPDOWN_KEYS as readonly string[]);
    if (normalized !== "default" && !allowed.has(normalized)) {
      return { ok: false, error: "Workspace profile is not allowed for manual assignment." };
    }
    await persistStaffWorkspaceProfileOverride({
      tenantId: tid,
      staffId: sid,
      profile: normalized === "default" ? "default" : (normalized as FiWorkspaceProfileKey),
      adminKey: adminKey ?? undefined,
    });
    revalidatePath(`/fi-admin/${tid}/staff`);
    revalidatePath(`/fi-admin/${tid}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
