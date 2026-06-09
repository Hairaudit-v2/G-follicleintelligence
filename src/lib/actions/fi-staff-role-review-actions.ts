"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { assertCrmTenantStaffManageAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  buildStaffRoleReviewWorkingHours,
  validateStaffRoleReviewSave,
  validateStaffRoleReviewSaveAll,
} from "@/src/lib/staff/staffRoleReviewApply";
import { loadStaffMemberForTenant, updateFiStaff } from "@/src/lib/staff/staff.server";
import type { StaffWeeklyHoursMap } from "@/src/lib/staff/staffWeeklyHours";

const staffDayHoursSchema = z.object({
  enabled: z.boolean().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

const reviewRowSchema = z.object({
  staffId: z.string().uuid(),
  staff_role: z.string().min(1).max(80),
  position_title: z.union([z.string(), z.null()]).optional(),
  primary_clinic_id: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  weekly: z.record(staffDayHoursSchema).optional(),
  is_active: z.boolean(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateStaffRoleReviewSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/staff`);
  revalidatePath(`/fi-admin/${tid}/staff/role-review`);
  revalidatePath(`/fi-admin/${tid}/hr/staff-import/payroll`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
  revalidatePath(`/fi-admin/${tid}/appointments`);
}

function parseWeekly(raw: Record<string, z.infer<typeof staffDayHoursSchema>> | undefined): StaffWeeklyHoursMap {
  if (!raw) return {};
  return raw as StaffWeeklyHoursMap;
}

async function applyReviewRow(
  tenantId: string,
  row: z.infer<typeof reviewRowSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validation = validateStaffRoleReviewSave({ staff_role: row.staff_role });
  if (validation) return { ok: false, error: validation };

  const existing = await loadStaffMemberForTenant(tenantId, row.staffId);
  if (!existing) return { ok: false, error: "Staff member not found." };

  const weekly = parseWeekly(row.weekly);
  const working_hours = buildStaffRoleReviewWorkingHours(
    {
      weekly,
      position_title: row.position_title?.trim() || null,
      primary_clinic_id: row.primary_clinic_id?.trim() || null,
    },
    existing.working_hours
  );

  await updateFiStaff(tenantId, row.staffId, {
    staff_role: row.staff_role.trim(),
    is_active: row.is_active,
    working_hours,
  });

  return { ok: true };
}

export async function saveStaffRoleReviewRowAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tid = tenantId.trim();
    await assertCrmTenantStaffManageAllowed({ tenantId: tid, request: undefined });
    const row = reviewRowSchema.parse(body);
    const result = await applyReviewRow(tid, row);
    if (!result.ok) return result;
    revalidateStaffRoleReviewSurfaces(tid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function saveAllStaffRoleReviewAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; savedCount: number } | { ok: false; error: string }> {
  try {
    const tid = tenantId.trim();
    await assertCrmTenantStaffManageAllowed({ tenantId: tid, request: undefined });
    const parsed = z.object({ rows: z.array(reviewRowSchema).min(1) }).parse(body);

    const saveAllErr = validateStaffRoleReviewSaveAll(
      parsed.rows.map((r) => ({
        staffId: r.staffId,
        full_name: "",
        email: null,
        mobile: null,
        staff_role: r.staff_role,
        position_title: null,
        primary_clinic_id: null,
        weekly: parseWeekly(r.weekly),
        is_active: r.is_active,
        payroll: null,
      }))
    );
    if (saveAllErr) return { ok: false, error: saveAllErr };

    for (const row of parsed.rows) {
      const result = await applyReviewRow(tid, row);
      if (!result.ok) return result;
    }

    revalidateStaffRoleReviewSurfaces(tid);
    return { ok: true, savedCount: parsed.rows.length };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
