import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadAllStaffForTenant, type FiStaffRow } from "@/src/lib/staff/staff.server";
import { loadAllTenantStaffMembers } from "@/src/lib/workforce-os/hrReconciliation.server";
import {
  buildRosterStaffEligibilityContext,
  type RosterIneligibleStaffOption,
  type RosterStaffEligibilityContext,
} from "@/src/lib/workforce-os/rosterEligibleStaffCore";
import type { StaffMemberLifecycleRow } from "@/src/lib/workforce-os/staffLifecycleTypes";

export type { RosterIneligibleStaffOption, RosterStaffEligibilityContext };
export {
  buildRosterStaffEligibilityContext,
  listRosterEligibleStaffMissingStandardHours,
  resolveDefaultRosterStaffIds,
} from "@/src/lib/workforce-os/rosterEligibleStaffCore";

type AvailabilityBlockRow = {
  staff_id: string;
  block_type: string;
  starts_at: string;
  ends_at: string;
  status?: string | null;
};

function indexMembersByFiStaffId(
  members: StaffMemberLifecycleRow[]
): Map<string, StaffMemberLifecycleRow> {
  const out = new Map<string, StaffMemberLifecycleRow>();
  for (const member of members) {
    const fiStaffId = member.fi_staff_id?.trim();
    if (!fiStaffId) continue;
    out.set(fiStaffId, member);
  }
  return out;
}

export async function loadRosterStaffEligibilityContext(
  tenantId: string,
  input: {
    periodDayDates: string[];
    availabilityBlocks?: AvailabilityBlockRow[];
    staffRows?: FiStaffRow[];
    client?: SupabaseClient;
  }
): Promise<RosterStaffEligibilityContext> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const [staffRows, members] = await Promise.all([
    input.staffRows ? Promise.resolve(input.staffRows) : loadAllStaffForTenant(tid, input.client),
    loadAllTenantStaffMembers(tid, input.client),
  ]);

  return buildRosterStaffEligibilityContext({
    staffRows,
    membersByFiStaffId: indexMembersByFiStaffId(members),
    periodDayDates: input.periodDayDates,
    availabilityBlocks: input.availabilityBlocks,
  });
}
