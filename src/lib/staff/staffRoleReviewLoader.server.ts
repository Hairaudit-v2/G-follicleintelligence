import "server-only";

import { assertCrmTenantStaffManageAllowed } from "@/src/lib/crm/crmGate";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  buildStaffPayrollSourceDisplay,
  type StaffPayrollSourceDisplay,
} from "@/src/lib/staff/staffPayrollSourceDisplay";
import { parseStaffProfileExtras } from "@/src/lib/staff/staffProfileExtras";
import type { StaffDirectoryClinicOption } from "@/src/lib/staff/staffDirectoryLoader.server";
import {
  buildStaffRoleReviewEditableRow,
  filterActiveNeedsReviewStaff,
} from "@/src/lib/staff/staffRoleReviewApply";
import type { StaffRoleReviewEditableRow } from "@/src/lib/staff/staffRoleReviewApply";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import { loadHrNotificationByStaffId } from "@/src/lib/staff/staffHrNotificationLoader.server";
import { EVOLVED_PAYROLL_SOURCE_SYSTEM } from "@/src/lib/staffImport/evolvedPayrollStaffImportConstants";
import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type StaffRoleReviewPageModel = {
  rows: StaffRoleReviewEditableRow[];
  clinics: StaffDirectoryClinicOption[];
};

async function loadClinicsForTenant(tenantId: string): Promise<StaffDirectoryClinicOption[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, display_name")
    .eq("tenant_id", tenantId)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as { id: string; display_name: string };
    return { id: String(row.id), display_name: String(row.display_name ?? "").trim() || "Clinic" };
  });
}

async function loadPayrollByStaffId(
  tenantId: string,
  staffIds: string[]
): Promise<Record<string, StaffPayrollSourceDisplay | null>> {
  const out: Record<string, StaffPayrollSourceDisplay | null> = {};
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

export async function loadStaffRoleReviewPage(tenantId: string): Promise<StaffRoleReviewPageModel> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  await assertCrmTenantStaffManageAllowed({ tenantId: tid, request: undefined });

  const [allStaff, clinics] = await Promise.all([
    loadAllStaffForTenant(tid),
    loadClinicsForTenant(tid),
  ]);
  const needsReview = filterActiveNeedsReviewStaff(allStaff);
  const staffIds = needsReview.map((s) => s.id);
  const [payrollByStaffId, hrNotificationByStaffId] = await Promise.all([
    loadPayrollByStaffId(tid, staffIds),
    loadHrNotificationByStaffId(tid, staffIds),
  ]);

  const rows = needsReview.map((s) =>
    buildStaffRoleReviewEditableRow(
      s,
      payrollByStaffId[s.id] ?? null,
      parseStaffProfileExtras(s.working_hours),
      hrNotificationByStaffId[s.id]
    )
  );

  return { rows, clinics };
}
