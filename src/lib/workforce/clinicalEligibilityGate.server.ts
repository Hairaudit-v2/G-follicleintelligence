import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { calculateStaffClinicalEligibility } from "@/src/lib/workforce/clinicalEligibility.server";

export class StaffClinicalEligibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffClinicalEligibilityError";
  }
}

export function formatClinicalEligibilityBlockMessage(
  staffName: string,
  blockingReasons: string[]
): string {
  const reason = blockingReasons[0] ?? "Not clinically eligible";
  return `Cannot assign ${staffName}. Reason: ${reason}`;
}

/**
 * Sprint 3 gate — runs after existing SurgeryOS / CalendarOS permission checks.
 * Does not bypass readiness or role permission layers.
 */
export async function assertStaffMeetsClinicalEligibilityForAssignment(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<void> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const supabase = client ?? supabaseAdmin();

  const eligibility = await calculateStaffClinicalEligibility({
    tenantId: tid,
    staffId: sid,
    client: supabase,
  });

  if (eligibility.eligible) return;

  const staff = await loadStaffMemberForTenant(tid, sid, supabase);
  const name = staff?.full_name?.trim() || "staff member";

  throw new StaffClinicalEligibilityError(
    formatClinicalEligibilityBlockMessage(name, eligibility.blockingReasons)
  );
}