"use server";

import { revalidatePath } from "next/cache";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isFiFeatureKey, type FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import {
  assertStaffFeatureAccessMutationAllowed,
  loadStaffFeatureAccessOverrides,
  persistStaffFeatureAccessPatch,
} from "@/src/lib/fi-os/featureAccess.server";
import { buildFeatureOverrideChangedAuditInsert } from "@/src/lib/fi-os/staffFeatureAccessAuditPayload";
import {
  resolveActorIdsForFiOsAudit,
  tryInsertFiStaffFeatureAccessAuditEvent,
} from "@/src/lib/fi-os/staffFeatureAccessAudit.server";

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function saveStaffFeatureAccessPatchAction(
  tenantId: string,
  staffId: string,
  patch: Record<string, boolean>,
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
    const normalized: Partial<Record<FiFeatureKey, boolean>> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (!isFiFeatureKey(k)) continue;
      normalized[k] = Boolean(v);
    }
    const editor = await resolveAuthUserId(null);
    const actors = await resolveActorIdsForFiOsAudit(tid, editor);
    const oldOverrides = await loadStaffFeatureAccessOverrides(tid, sid);
    await persistStaffFeatureAccessPatch({
      tenantId: tid,
      staffId: sid,
      patch: normalized,
      editorAuthUserId: editor,
    });
    const auditRow = buildFeatureOverrideChangedAuditInsert({
      tenantId: tid,
      staffId: sid,
      actorUserId: actors.actor_user_id,
      actorFiUserId: actors.actor_fi_user_id,
      oldOverrides,
      newPatch: normalized,
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
