"use server";

import { revalidatePath } from "next/cache";

import { assertStaffFeatureAccessMutationAllowed } from "@/src/lib/fi-os/featureAccess.server";
import { buildPositionTypeChangedAuditInsert } from "@/src/lib/fi-os/staffFeatureAccessAuditPayload";
import {
  resolveActorIdsForFiOsAudit,
  tryInsertFiStaffFeatureAccessAuditEvent,
} from "@/src/lib/fi-os/staffFeatureAccessAudit.server";
import { loadStaffMemberForTenant, updateFiStaff } from "@/src/lib/staff/staff.server";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";

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
): Promise<{ ok: true; auditWarning?: string } | { ok: false; error: string }> {
  try {
    const tid = tenantId.trim();
    const sid = staffId.trim();
    if (!tid || !sid) return { ok: false, error: "Missing tenant or staff id." };
    await assertStaffFeatureAccessMutationAllowed({
      tenantId: tid,
      adminKey: adminKey ?? undefined,
    });
    const staffBefore = await loadStaffMemberForTenant(tid, sid);
    if (!staffBefore) return { ok: false, error: "Staff not found." };
    const oldPt = staffBefore.position_type_id?.trim() || null;
    const normalized = positionTypeId?.trim() || null;
    const editor = await resolveAuthUserId(null);
    const actors = await resolveActorIdsForFiOsAudit(tid, editor);
    await updateFiStaff(tid, sid, { position_type_id: normalized });
    const auditRow = buildPositionTypeChangedAuditInsert({
      tenantId: tid,
      staffId: sid,
      actorUserId: actors.actor_user_id,
      actorFiUserId: actors.actor_fi_user_id,
      oldPositionTypeId: oldPt,
      newPositionTypeId: normalized,
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
