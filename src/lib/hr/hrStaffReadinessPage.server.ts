import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertCrmTenantWriteAllowed, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import {
  buildStaffReadinessOverview,
  buildStaffReadinessTableRows,
  canPerformStaffReadinessAdminAction,
  type StaffReadinessOverview,
  type StaffReadinessTableRow,
} from "@/src/lib/hr/hrStaffReadinessDashboard";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import { loadHrNotificationByStaffId } from "@/src/lib/staff/staffHrNotificationLoader.server";
import { buildStaffPayrollSourceDisplay } from "@/src/lib/staff/staffPayrollSourceDisplay";
import { EVOLVED_PAYROLL_SOURCE_SYSTEM } from "@/src/lib/staffImport/evolvedPayrollStaffImportConstants";
import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";

export type HrStaffReadinessPageModel = {
  overview: StaffReadinessOverview;
  rows: StaffReadinessTableRow[];
  canPerformAdminActions: boolean;
};

async function loadPayrollSourceByStaffId(
  tenantId: string,
  staffIds: string[]
): Promise<Record<string, ReturnType<typeof buildStaffPayrollSourceDisplay>>> {
  const out: Record<string, ReturnType<typeof buildStaffPayrollSourceDisplay>> = {};
  for (const id of staffIds) out[id] = null;
  if (!staffIds.length) return out;

  const supabase = supabaseAdmin();
  const payrollSys = normalizeFiStaffSourceSystem(EVOLVED_PAYROLL_SOURCE_SYSTEM);
  const { data, error } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_system, source_staff_id, metadata")
    .eq("tenant_id", tenantId)
    .in("staff_id", staffIds)
    .eq("source_system", payrollSys);
  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const r = raw as {
      staff_id: string;
      source_system: string;
      source_staff_id: string;
      metadata: unknown;
    };
    const md =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null;
    out[String(r.staff_id)] = buildStaffPayrollSourceDisplay({
      source_system: String(r.source_system),
      source_staff_id: String(r.source_staff_id),
      metadata: md,
    });
  }
  return out;
}

async function loadClinicNameById(tenantId: string): Promise<Record<string, string>> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, display_name")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const raw of data ?? []) {
    const row = raw as { id: string; display_name: string };
    out[String(row.id)] = String(row.display_name ?? "").trim() || "Clinic";
  }
  return out;
}

async function resolveCanPerformAdminActions(tenantId: string): Promise<boolean> {
  const authId = await resolveAuthUserId(null);
  if (!authId) return false;
  const os = await loadFiOsIdentity(authId);
  if (isFiOsPlatformAdminRole(os?.osRole)) {
    return canPerformStaffReadinessAdminAction({
      userRole: null,
      isPlatformAdmin: true,
      hasValidAdminKey: false,
    });
  }
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const role = data ? String((data as { role: string | null }).role ?? "member") : null;
  return canPerformStaffReadinessAdminAction({
    userRole: role,
    isPlatformAdmin: false,
    hasValidAdminKey: false,
  });
}

export async function loadHrStaffReadinessPageModel(
  tenantId: string
): Promise<HrStaffReadinessPageModel> {
  const tid = tenantId.trim();
  await assertCrmTenantWriteAllowed({ tenantId: tid, request: undefined });

  const [staff, clinicNameById, canPerformAdminActions] = await Promise.all([
    loadAllStaffForTenant(tid),
    loadClinicNameById(tid),
    resolveCanPerformAdminActions(tid),
  ]);

  const staffIds = staff.map((s) => s.id);
  const [hrByStaffId, payrollByStaffId] = await Promise.all([
    loadHrNotificationByStaffId(tid, staffIds),
    loadPayrollSourceByStaffId(tid, staffIds),
  ]);

  const rows = buildStaffReadinessTableRows({
    staff: staff.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      staff_role: s.staff_role,
      working_hours: s.working_hours,
      is_active: s.is_active,
    })),
    hrByStaffId,
    payrollByStaffId,
    clinicNameById,
  });

  return {
    overview: buildStaffReadinessOverview(rows),
    rows,
    canPerformAdminActions,
  };
}
