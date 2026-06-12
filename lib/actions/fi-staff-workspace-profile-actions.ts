"use server";

import { revalidatePath } from "next/cache";

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { FI_WORKSPACE_PROFILE_ADMIN_DROPDOWN_KEYS } from "@/src/config/fiWorkspaceProfiles";
import {
  assertAssignableWorkspaceProfileKey,
  persistStaffWorkspaceProfileOverride,
} from "@/src/lib/fi-os/workspaceProfile.server";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { buildWorkspaceProfileChangedAuditInsert } from "@/src/lib/fi-os/staffFeatureAccessAuditPayload";
import { resolveActorIdsForFiOsAudit, tryInsertFiStaffFeatureAccessAuditEvent } from "@/src/lib/fi-os/staffFeatureAccessAudit.server";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function saveStaffWorkspaceProfileAction(
  tenantId: string,
  staffId: string,
  profileKey: string,
  adminKey?: string | null
): Promise<{ ok: true; auditWarning?: string } | { ok: false; error: string }> {
  try {
    const tid = tenantId.trim();
    const sid = staffId.trim();
    if (!tid || !sid) return { ok: false, error: "Missing tenant or staff id." };
    const normalized = assertAssignableWorkspaceProfileKey(profileKey);
    const allowed = new Set<string>(FI_WORKSPACE_PROFILE_ADMIN_DROPDOWN_KEYS as readonly string[]);
    if (normalized !== "default" && !allowed.has(normalized)) {
      return { ok: false, error: "Workspace profile is not allowed for manual assignment." };
    }
    const staffBefore = await loadStaffMemberForTenant(tid, sid);
    if (!staffBefore) return { ok: false, error: "Staff not found." };
    const oldProfile =
      typeof staffBefore.staff_metadata?.workspace_profile === "string"
        ? staffBefore.staff_metadata.workspace_profile.trim() || null
        : null;
    const editor = await resolveAuthUserId(null);
    const actors = await resolveActorIdsForFiOsAudit(tid, editor);
    await persistStaffWorkspaceProfileOverride({
      tenantId: tid,
      staffId: sid,
      profile: normalized === "default" ? "default" : (normalized as FiWorkspaceProfileKey),
      adminKey: adminKey ?? undefined,
    });
    const newProfile = normalized === "default" ? "default" : normalized;
    const auditRow = buildWorkspaceProfileChangedAuditInsert({
      tenantId: tid,
      staffId: sid,
      actorUserId: actors.actor_user_id,
      actorFiUserId: actors.actor_fi_user_id,
      oldProfile,
      newProfile,
    });
    const ar = await tryInsertFiStaffFeatureAccessAuditEvent(auditRow);
    const auditWarning = ar.ok ? undefined : `Saved, but audit log failed: ${ar.error}`;
    revalidatePath(`/fi-admin/${tid}/staff`);
    revalidatePath(`/fi-admin/${tid}`);
    return { ok: true, auditWarning };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
