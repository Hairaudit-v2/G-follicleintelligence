"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaffAccessAdminPermission } from "@/src/lib/staffAccess/staffAccess.server";
import {
  revokeStaffFieldAccessGrant,
  upsertStaffFieldAccessGrant,
} from "@/src/lib/staffAccess/staffFieldAccess.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";
import { STAFF_ACCESS_SCOPES } from "@/src/lib/staffAccess/staffAccessRegistry";
import {
  STAFF_ACCESS_FIELDS_BY_KEY,
  STAFF_FIELD_PERMISSION_LEVELS,
} from "@/src/lib/staffAccess/staffFieldAccessRegistry";

export type FiStaffFieldAccessActionResult = { ok: true } | { ok: false; error: string };

const levelEnum = z.enum(STAFF_FIELD_PERMISSION_LEVELS);
const scopeEnum = z.enum(STAFF_ACCESS_SCOPES);

const upsertSchema = z.object({
  tenantId: z.string().uuid(),
  staffMemberId: z.string().uuid(),
  moduleKey: z.string().trim().min(1).max(60),
  fieldKey: z.string().trim().min(1).max(120),
  permissionLevel: levelEnum,
  scope: scopeEnum,
  clinicId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().max(2000).optional().nullable(),
});

const revokeSchema = z.object({
  tenantId: z.string().uuid(),
  grantId: z.string().uuid(),
  reason: z.string().trim().max(2000).optional().nullable(),
});

function errMsg(e: unknown): string {
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

function revalidate(tenantId: string) {
  revalidatePath(`/fi-admin/${tenantId}/settings/staff-access`);
}

/**
 * Create or update the single active field grant for (staff, module, field, scope, clinic).
 * The grant is validated against the SA-2 registry and module access is enforced at read time
 * by the engine (a grant that exceeds module access is clamped, not stored as effective).
 */
export async function upsertStaffFieldAccessGrantAction(
  body: unknown
): Promise<FiStaffFieldAccessActionResult> {
  try {
    const parsed = upsertSchema.parse(body);
    const tid = parsed.tenantId.trim();

    // Field/module must be a known protected field.
    const def = STAFF_ACCESS_FIELDS_BY_KEY[parsed.fieldKey];
    if (!def || def.moduleKey !== parsed.moduleKey) {
      return { ok: false, error: "Unknown protected field for that module." };
    }

    await rejectStaffPinSessionForRestrictedMutation(tid);
    const perm = await getStaffAccessAdminPermission(tid);
    if (!perm.canManage) {
      return {
        ok: false,
        error: "You do not have permission to manage staff access for this clinic.",
      };
    }

    const res = await upsertStaffFieldAccessGrant({
      tenantId: tid,
      staffMemberId: parsed.staffMemberId,
      moduleKey: parsed.moduleKey,
      fieldKey: parsed.fieldKey,
      permissionLevel: parsed.permissionLevel,
      scope: parsed.scope,
      clinicId: parsed.scope === "clinic" && parsed.clinicId ? parsed.clinicId : null,
      reason: parsed.reason ?? null,
      actorAuthUserId: perm.actorAuthUserId,
    });
    if (!res.ok) return { ok: false, error: res.error };

    revalidate(tid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Revoke an active field grant (soft delete via revoked_at) and audit it. */
export async function revokeStaffFieldAccessGrantAction(
  body: unknown
): Promise<FiStaffFieldAccessActionResult> {
  try {
    const parsed = revokeSchema.parse(body);
    const tid = parsed.tenantId.trim();

    await rejectStaffPinSessionForRestrictedMutation(tid);
    const perm = await getStaffAccessAdminPermission(tid);
    if (!perm.canManage) {
      return {
        ok: false,
        error: "You do not have permission to manage staff access for this clinic.",
      };
    }

    const res = await revokeStaffFieldAccessGrant({
      tenantId: tid,
      grantId: parsed.grantId,
      reason: parsed.reason ?? null,
      actorAuthUserId: perm.actorAuthUserId,
    });
    if (!res.ok) return { ok: false, error: res.error };

    revalidate(tid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
