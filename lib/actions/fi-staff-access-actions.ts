"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { getStaffAccessAdminPermission } from "@/src/lib/staffAccess/staffAccess.server";
import { tryInsertStaffAccessAuditEvent } from "@/src/lib/staffAccess/staffAccessAudit.server";
import {
  STAFF_ACCESS_LEVELS,
  STAFF_ACCESS_MODULE_KEYS,
  STAFF_ACCESS_SCOPES,
} from "@/src/lib/staffAccess/staffAccessRegistry";

export type FiStaffAccessActionResult = { ok: true } | { ok: false; error: string };

const moduleEnum = z.enum(STAFF_ACCESS_MODULE_KEYS);
const levelEnum = z.enum(STAFF_ACCESS_LEVELS);
const scopeEnum = z.enum(STAFF_ACCESS_SCOPES);

const upsertGrantSchema = z.object({
  tenantId: z.string().uuid(),
  staffMemberId: z.string().uuid(),
  moduleKey: moduleEnum,
  tabKey: z.string().trim().max(120).optional().nullable(),
  accessLevel: levelEnum,
  scope: scopeEnum,
  clinicId: z.string().uuid().optional().nullable(),
  roleKey: z.string().trim().max(60).optional().nullable(),
  reason: z.string().trim().max(2000).optional().nullable(),
});

const revokeGrantSchema = z.object({
  tenantId: z.string().uuid(),
  grantId: z.string().uuid(),
  reason: z.string().trim().max(2000).optional().nullable(),
});

function errMsg(e: unknown): string {
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

function revalidateStaffAccess(tenantId: string) {
  revalidatePath(`/fi-admin/${tenantId}/settings/staff-access`);
}

/**
 * Create or update the single active grant for (staff, module, tab, clinic). Writes an audit
 * row capturing previous vs new access. Setting `accessLevel: 'none'` is treated as an explicit
 * suppression grant (it overrides the role template downwards).
 */
export async function upsertStaffAccessGrantAction(
  body: unknown
): Promise<FiStaffAccessActionResult> {
  try {
    const parsed = upsertGrantSchema.parse(body);
    const tid = parsed.tenantId.trim();
    await rejectStaffPinSessionForRestrictedMutation(tid);

    const perm = await getStaffAccessAdminPermission(tid);
    if (!perm.canManage) {
      return {
        ok: false,
        error: "You do not have permission to manage staff access for this clinic.",
      };
    }

    const supabase = supabaseAdmin();
    const tabKey = parsed.tabKey?.trim() || null;
    const clinicId = parsed.clinicId?.trim() || null;

    // Find an existing active grant for this exact scope.
    let existingQuery = supabase
      .from("fi_staff_access_grants")
      .select("id, access_level, scope, tab_key, clinic_id")
      .eq("tenant_id", tid)
      .eq("staff_member_id", parsed.staffMemberId)
      .eq("module_key", parsed.moduleKey)
      .is("revoked_at", null);
    existingQuery = tabKey
      ? existingQuery.eq("tab_key", tabKey)
      : existingQuery.is("tab_key", null);
    existingQuery = clinicId
      ? existingQuery.eq("clinic_id", clinicId)
      : existingQuery.is("clinic_id", null);
    const { data: existing } = await existingQuery.maybeSingle();

    const newAccess = {
      access_level: parsed.accessLevel,
      scope: parsed.scope,
      clinic_id: clinicId,
      tab_key: tabKey,
    };

    if (existing) {
      const prev = existing as { id: string; access_level: string; scope: string };
      const { error } = await supabase
        .from("fi_staff_access_grants")
        .update({
          access_level: parsed.accessLevel,
          scope: parsed.scope,
          role_key: parsed.roleKey?.trim() || null,
          granted_by: perm.actorAuthUserId,
          metadata: parsed.reason?.trim() ? { reason: parsed.reason.trim() } : {},
        })
        .eq("id", prev.id)
        .eq("tenant_id", tid);
      if (error) return { ok: false, error: error.message };

      await tryInsertStaffAccessAuditEvent({
        tenantId: tid,
        staffMemberId: parsed.staffMemberId,
        changedBy: perm.actorAuthUserId,
        action: "grant_updated",
        moduleKey: parsed.moduleKey,
        tabKey,
        previousAccess: { access_level: prev.access_level, scope: prev.scope },
        newAccess,
        reason: parsed.reason?.trim() || null,
      });
    } else {
      const { error } = await supabase.from("fi_staff_access_grants").insert({
        tenant_id: tid,
        clinic_id: clinicId,
        staff_member_id: parsed.staffMemberId,
        role_key: parsed.roleKey?.trim() || null,
        module_key: parsed.moduleKey,
        tab_key: tabKey,
        access_level: parsed.accessLevel,
        scope: parsed.scope,
        granted_by: perm.actorAuthUserId,
        metadata: parsed.reason?.trim() ? { reason: parsed.reason.trim() } : {},
      });
      if (error) return { ok: false, error: error.message };

      await tryInsertStaffAccessAuditEvent({
        tenantId: tid,
        staffMemberId: parsed.staffMemberId,
        changedBy: perm.actorAuthUserId,
        action: "grant_created",
        moduleKey: parsed.moduleKey,
        tabKey,
        previousAccess: null,
        newAccess,
        reason: parsed.reason?.trim() || null,
      });
    }

    revalidateStaffAccess(tid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Revoke an active grant (soft delete via revoked_at) and audit it. */
export async function revokeStaffAccessGrantAction(
  body: unknown
): Promise<FiStaffAccessActionResult> {
  try {
    const parsed = revokeGrantSchema.parse(body);
    const tid = parsed.tenantId.trim();
    await rejectStaffPinSessionForRestrictedMutation(tid);

    const perm = await getStaffAccessAdminPermission(tid);
    if (!perm.canManage) {
      return {
        ok: false,
        error: "You do not have permission to manage staff access for this clinic.",
      };
    }

    const supabase = supabaseAdmin();
    const { data: existing, error: findErr } = await supabase
      .from("fi_staff_access_grants")
      .select("id, staff_member_id, module_key, tab_key, access_level, scope, revoked_at")
      .eq("id", parsed.grantId)
      .eq("tenant_id", tid)
      .maybeSingle();
    if (findErr) return { ok: false, error: findErr.message };
    if (!existing) return { ok: false, error: "Grant not found." };
    const row = existing as {
      id: string;
      staff_member_id: string;
      module_key: string;
      tab_key: string | null;
      access_level: string;
      scope: string;
      revoked_at: string | null;
    };
    if (row.revoked_at) return { ok: true };

    const { error } = await supabase
      .from("fi_staff_access_grants")
      .update({ revoked_at: new Date().toISOString(), revoked_by: perm.actorAuthUserId })
      .eq("id", row.id)
      .eq("tenant_id", tid);
    if (error) return { ok: false, error: error.message };

    await tryInsertStaffAccessAuditEvent({
      tenantId: tid,
      staffMemberId: row.staff_member_id,
      changedBy: perm.actorAuthUserId,
      action: "grant_revoked",
      moduleKey: row.module_key,
      tabKey: row.tab_key,
      previousAccess: { access_level: row.access_level, scope: row.scope },
      newAccess: null,
      reason: parsed.reason?.trim() || null,
    });

    revalidateStaffAccess(tid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
