import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  pickStaffHrNotificationFromSourceRows,
  type StaffHrNotificationSourceRow,
} from "@/src/lib/staff/staffHrNotificationSummary";
import { isClinicalProviderStaffRole } from "@/src/lib/hr/hrStaffReadinessDashboard";
import {
  buildClinicalStaffPickerReadiness,
  clinicalAssignmentErrorMessage,
  isSupportStaffRole,
  staffAllowedInProcedureSlot,
  type ProcedureTeamSlotKind,
} from "@/src/lib/staff/clinicalStaffPicker";
import { isStaffBookableForClinicalWorkflow } from "@/src/lib/staff/staffRolePolicy";
import {
  assertFiStaffBelongsToTenant,
  loadStaffMemberForTenant,
} from "@/src/lib/staff/staff.server";
import {
  assertStaffMeetsClinicalEligibilityForAssignment,
  StaffClinicalEligibilityError,
} from "@/src/lib/workforce/clinicalEligibilityGate.server";

export class StaffClinicalAvailabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffClinicalAvailabilityError";
  }
}

async function loadHrSummaryForStaff(
  tenantId: string,
  staffId: string,
  client: SupabaseClient
): Promise<ReturnType<typeof pickStaffHrNotificationFromSourceRows>> {
  const { data, error } = await client
    .from("fi_staff_source_ids")
    .select("source_system, source_staff_id, source_url, metadata")
    .eq("tenant_id", tenantId.trim())
    .eq("staff_id", staffId.trim());
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((raw) => {
    const r = raw as StaffHrNotificationSourceRow;
    const md =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null;
    return {
      source_system: String((r as { source_system: string }).source_system),
      source_staff_id: (r as { source_staff_id?: string }).source_staff_id,
      source_url: (r as { source_url?: string | null }).source_url,
      metadata: md,
    };
  });
  return pickStaffHrNotificationFromSourceRows(rows);
}

export async function assertStaffClinicallyAvailableForAssignment(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const staff = await assertFiStaffBelongsToTenant(supabase, tenantId, staffId);
  const hr = await loadHrSummaryForStaff(tenantId, staff.id, supabase);
  const readiness = buildClinicalStaffPickerReadiness({
    full_name: staff.full_name,
    staff_role: staff.staff_role,
    is_active: staff.is_active,
    working_hours: staff.working_hours,
    hr,
  });
  if (!readiness.clinically_available) {
    throw new StaffClinicalAvailabilityError(
      clinicalAssignmentErrorMessage(readiness.block_reason)
    );
  }

  try {
    await assertStaffMeetsClinicalEligibilityForAssignment(tenantId, staff.id, supabase);
  } catch (e) {
    if (e instanceof StaffClinicalEligibilityError) {
      throw new StaffClinicalAvailabilityError(e.message);
    }
    throw e;
  }
}

export async function assertStaffAllowedForProcedureSlot(
  tenantId: string,
  staffId: string,
  slot: ProcedureTeamSlotKind,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const staff = await assertFiStaffBelongsToTenant(supabase, tenantId, staffId);
  if (!staffAllowedInProcedureSlot(staff.staff_role, slot)) {
    throw new StaffClinicalAvailabilityError(
      clinicalAssignmentErrorMessage(
        slot === "support"
          ? "Only admin, reception, or coordinator roles may fill support slots"
          : "Only clinical provider roles may fill this slot"
      )
    );
  }
  if (slot === "support") {
    if (!isStaffBookableForClinicalWorkflow(staff)) {
      throw new StaffClinicalAvailabilityError(
        clinicalAssignmentErrorMessage("Inactive or role needs review")
      );
    }
    return;
  }
  await assertStaffClinicallyAvailableForAssignment(tenantId, staff.id, supabase);
}

export async function loadStaffMemberByFiUserId(
  tenantId: string,
  fiUserId: string,
  client?: SupabaseClient
): Promise<Awaited<ReturnType<typeof loadStaffMemberForTenant>>> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const uid = fiUserId.trim();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id")
    .eq("tenant_id", tid)
    .eq("fi_user_id", uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return loadStaffMemberForTenant(tid, String((data as { id: string }).id), supabase);
}

export async function assertFiUserAllowedForProcedureSlot(
  tenantId: string,
  fiUserId: string,
  slot: ProcedureTeamSlotKind,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const staff = await loadStaffMemberByFiUserId(tenantId, fiUserId, supabase);
  if (!staff) {
    throw new StaffClinicalAvailabilityError(
      "Selected user has no linked staff profile. Link them in Staff settings before assignment."
    );
  }
  await assertStaffAllowedForProcedureSlot(tenantId, staff.id, slot, supabase);
}

export async function assertProcedureDayTeamAssignments(
  tenantId: string,
  input: {
    surgeonUserId?: string | null;
    nurseUserId?: string | null;
    technicianUserIds?: string[] | null;
    teamMemberUserIds?: string[] | null;
  },
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  if (input.surgeonUserId?.trim()) {
    await assertFiUserAllowedForProcedureSlot(tenantId, input.surgeonUserId, "clinical", supabase);
  }
  if (input.nurseUserId?.trim()) {
    await assertFiUserAllowedForProcedureSlot(tenantId, input.nurseUserId, "support", supabase);
  }
  for (const uid of input.technicianUserIds ?? []) {
    if (!uid?.trim()) continue;
    const staff = await loadStaffMemberByFiUserId(tenantId, uid, supabase);
    if (!staff) {
      throw new StaffClinicalAvailabilityError(
        "A technician has no linked staff profile. Link them in Staff settings before assignment."
      );
    }
    const slot: ProcedureTeamSlotKind = isSupportStaffRole(staff.staff_role)
      ? "support"
      : isClinicalProviderStaffRole(staff.staff_role)
        ? "clinical"
        : "clinical";
    if (!isSupportStaffRole(staff.staff_role) && !isClinicalProviderStaffRole(staff.staff_role)) {
      throw new StaffClinicalAvailabilityError(
        clinicalAssignmentErrorMessage("Role is not valid for technician assignment")
      );
    }
    await assertStaffAllowedForProcedureSlot(tenantId, staff.id, slot, supabase);
  }
  for (const uid of input.teamMemberUserIds ?? []) {
    if (!uid?.trim()) continue;
    const staff = await loadStaffMemberByFiUserId(tenantId, uid, supabase);
    if (!staff) {
      throw new StaffClinicalAvailabilityError(
        "A team member has no linked staff profile. Link them in Staff settings before assignment."
      );
    }
    const slot: ProcedureTeamSlotKind = isSupportStaffRole(staff.staff_role)
      ? "support"
      : isClinicalProviderStaffRole(staff.staff_role)
        ? "clinical"
        : "clinical";
    if (!isSupportStaffRole(staff.staff_role) && !isClinicalProviderStaffRole(staff.staff_role)) {
      throw new StaffClinicalAvailabilityError(
        clinicalAssignmentErrorMessage("Role is not valid for procedure team assignment")
      );
    }
    await assertStaffAllowedForProcedureSlot(tenantId, staff.id, slot, supabase);
  }
}

export async function assertAppointmentProcedureStaffAssignments(
  tenantId: string,
  input: {
    surgeonStaffId?: string | null;
    consultantStaffId?: string | null;
    techStaffId?: string | null;
  },
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  for (const staffId of [input.surgeonStaffId, input.consultantStaffId, input.techStaffId]) {
    if (!staffId?.trim()) continue;
    await assertStaffAllowedForProcedureSlot(tenantId, staffId, "clinical", supabase);
  }
}
