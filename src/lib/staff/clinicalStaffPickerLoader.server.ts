import "server-only";

import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { loadCrmShellStaffPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import {
  buildProcedureTeamPickerOption,
  enrichCrmShellStaffPickerOption,
  type ClinicalStaffPickerOption,
  type ProcedureTeamPickerOption,
} from "@/src/lib/staff/clinicalStaffPicker";
import { loadHrNotificationByStaffId } from "@/src/lib/staff/staffHrNotificationLoader.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

export async function enrichStaffPickerOptionsWithReadiness(
  tenantId: string,
  options: CrmShellUserPickerOption[]
): Promise<ClinicalStaffPickerOption[]> {
  const staffIds = options.map((o) => o.id);
  const hrByStaffId = await loadHrNotificationByStaffId(tenantId, staffIds);
  return options.map((o) => enrichCrmShellStaffPickerOption(o, hrByStaffId[o.id]));
}

/** Active bookable staff with HR readiness metadata for clinical pickers. */
export async function loadClinicalStaffPickerOptions(
  tenantId: string
): Promise<ClinicalStaffPickerOption[]> {
  const base = await loadCrmShellStaffPickerOptions(tenantId);
  return enrichStaffPickerOptionsWithReadiness(tenantId, base);
}

/** Staff linked to fi_users for SurgeryOS procedure day pickers. */
export async function loadProcedureTeamPickerOptions(
  tenantId: string
): Promise<ProcedureTeamPickerOption[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id, full_name, staff_role, fi_user_id, working_hours, is_active")
    .eq("tenant_id", tid)
    .eq("is_active", true)
    .not("fi_user_id", "is", null)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);

  const staffRows = (data ?? []).map((raw) => {
    const r = raw as {
      id: string;
      full_name: string;
      staff_role: string;
      fi_user_id: string;
      working_hours: unknown;
      is_active: boolean;
    };
    const wh =
      r.working_hours && typeof r.working_hours === "object" && !Array.isArray(r.working_hours)
        ? (r.working_hours as Record<string, unknown>)
        : null;
    return {
      id: String(r.id),
      full_name: String(r.full_name ?? "").trim() || "Staff",
      staff_role: String(r.staff_role ?? "consultant").trim() || "consultant",
      fi_user_id: String(r.fi_user_id),
      working_hours: wh,
      is_active: Boolean(r.is_active),
    };
  });

  const hrByStaffId = await loadHrNotificationByStaffId(
    tid,
    staffRows.map((s) => s.id)
  );

  const out: ProcedureTeamPickerOption[] = [];
  for (const s of staffRows) {
    const opt = buildProcedureTeamPickerOption({ staff: s, hr: hrByStaffId[s.id] });
    if (opt) out.push(opt);
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}
