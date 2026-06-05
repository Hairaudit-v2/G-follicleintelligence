"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { assertCrmTenantStaffManageAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { staffCreateBodySchema, staffPatchBodySchema } from "@/src/lib/staff/staffApiSchemas";
import { insertFiStaff, updateFiStaff } from "@/src/lib/staff/staff.server";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function normalizeEmail(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function normalizeOptionalUuid(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

export async function createStaffAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const parsed = staffCreateBodySchema.parse(body);
    await assertCrmTenantStaffManageAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const row = await insertFiStaff(tenantId.trim(), {
      full_name: parsed.full_name,
      staff_role: parsed.staff_role,
      email: normalizeEmail(parsed.email ?? null),
      mobile: parsed.mobile?.trim() || null,
      default_timezone: parsed.default_timezone?.trim() || null,
      working_hours: parsed.working_hours ?? {},
      is_active: parsed.is_active,
      calendar_color: parsed.calendar_color?.trim() || null,
      fi_user_id: normalizeOptionalUuid(parsed.fi_user_id),
    });

    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/staff`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    revalidatePath(`/fi-admin/${tid}`);
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateStaffAction(
  tenantId: string,
  staffId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = staffPatchBodySchema.parse(body);
    await assertCrmTenantStaffManageAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const patch: Parameters<typeof updateFiStaff>[2] = {};
    if (parsed.full_name !== undefined) patch.full_name = parsed.full_name;
    if (parsed.staff_role !== undefined) patch.staff_role = parsed.staff_role;
    if (parsed.email !== undefined) patch.email = normalizeEmail(parsed.email ?? null);
    if (parsed.mobile !== undefined) patch.mobile = parsed.mobile?.trim() || null;
    if (parsed.default_timezone !== undefined) patch.default_timezone = parsed.default_timezone?.trim() || null;
    if (parsed.working_hours !== undefined) patch.working_hours = parsed.working_hours ?? {};
    if (parsed.is_active !== undefined) patch.is_active = parsed.is_active;
    if (parsed.calendar_color !== undefined) patch.calendar_color = parsed.calendar_color?.trim() || null;
    if (parsed.fi_user_id !== undefined) patch.fi_user_id = normalizeOptionalUuid(parsed.fi_user_id);

    await updateFiStaff(tenantId.trim(), staffId.trim(), patch);

    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/staff`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    revalidatePath(`/fi-admin/${tid}`);
    revalidatePath(`/fi-admin/${tid}/appointments`);
    revalidatePath(`/fi-admin/${tid}/patients`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
