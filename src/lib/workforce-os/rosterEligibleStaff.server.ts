import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadAllStaffForTenant, type FiStaffRow } from "@/src/lib/staff/staff.server";
import { loadAllTenantStaffMembers } from "@/src/lib/workforce-os/hrReconciliation.server";
import {
  evaluateRosterStaffEligibility,
  listStaffMissingStandardHoursForRoster,
  resolveEmploymentStatusForRosterStaff,
  resolveRosterEligibleStaffIds,
  rosterIneligibilityReasonLabel,
  type RosterIneligibilityReason,
  type RosterStaffEligibilitySnapshot,
} from "@/src/lib/workforce-os/rosterEligibleStaffCore";
import type { StaffMemberLifecycleRow } from "@/src/lib/workforce-os/staffLifecycleTypes";
import type { StaffStandardHoursDayInput } from "@/src/lib/workforce-os/staffStandardHoursCore";

export type RosterIneligibleStaffOption = {
  id: string;
  name: string;
  role: string | null;
  reason: RosterIneligibilityReason;
  reasonLabel: string;
};

export type RosterStaffEligibilityContext = {
  eligibleStaffIds: string[];
  eligibilityByStaffId: Map<string, RosterStaffEligibilitySnapshot>;
  ineligibleStaffOptions: RosterIneligibleStaffOption[];
  periodDayDates: string[];
};

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

function groupAvailabilityBlocksByStaffId(
  blocks: AvailabilityBlockRow[]
): Map<string, AvailabilityBlockRow[]> {
  const out = new Map<string, AvailabilityBlockRow[]>();
  for (const block of blocks) {
    const staffId = block.staff_id.trim();
    if (!staffId) continue;
    const list = out.get(staffId) ?? [];
    list.push(block);
    out.set(staffId, list);
  }
  return out;
}

export function buildRosterStaffEligibilityContext(input: {
  staffRows: FiStaffRow[];
  membersByFiStaffId: Map<string, StaffMemberLifecycleRow>;
  periodDayDates: string[];
  availabilityBlocks?: AvailabilityBlockRow[];
}): RosterStaffEligibilityContext {
  const blocksByStaffId = groupAvailabilityBlocksByStaffId(input.availabilityBlocks ?? []);
  const eligibilityByStaffId = new Map<string, RosterStaffEligibilitySnapshot>();
  const eligibleStaffIds: string[] = [];
  const ineligibleStaffOptions: RosterIneligibleStaffOption[] = [];

  for (const staff of input.staffRows) {
    const member = input.membersByFiStaffId.get(staff.id) ?? null;
    const employmentStatus = resolveEmploymentStatusForRosterStaff({
      isActive: staff.is_active,
      employmentStatus: member?.employment_status,
    });
    const snapshot = evaluateRosterStaffEligibility({
      staffId: staff.id,
      isActive: staff.is_active,
      employmentStatus,
      archivedAt: member?.archived_at ?? null,
      tenantId: staff.tenant_id,
      periodDayDates: input.periodDayDates,
      availabilityBlocks: (blocksByStaffId.get(staff.id) ?? []).map((block) => ({
        block_type: block.block_type as import("@/src/lib/workforce-os/workforceRosteringEngine").AvailabilityBlockType,
        starts_at: block.starts_at,
        ends_at: block.ends_at,
        status: block.status,
      })),
      staffTimezone: staff.default_timezone,
    });

    eligibilityByStaffId.set(staff.id, snapshot);
    if (snapshot.eligible) {
      eligibleStaffIds.push(staff.id);
      continue;
    }

    if (snapshot.reason) {
      ineligibleStaffOptions.push({
        id: staff.id,
        name: staff.full_name?.trim() || "Staff",
        role: staff.staff_role?.trim() || null,
        reason: snapshot.reason,
        reasonLabel: rosterIneligibilityReasonLabel(snapshot.reason),
      });
    }
  }

  return {
    eligibleStaffIds,
    eligibilityByStaffId,
    ineligibleStaffOptions,
    periodDayDates: [...input.periodDayDates],
  };
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

export function resolveDefaultRosterStaffIds(
  staffRows: FiStaffRow[],
  requestedStaffIds: string[] | undefined,
  eligibilityByStaffId: Map<string, RosterStaffEligibilitySnapshot>
): string[] {
  const scope =
    requestedStaffIds?.length && requestedStaffIds.length > 0
      ? requestedStaffIds
      : staffRows.map((staff) => staff.id);
  return resolveRosterEligibleStaffIds(scope, eligibilityByStaffId);
}

export function listRosterEligibleStaffMissingStandardHours(input: {
  staffOptions: Array<{ id: string; name: string }>;
  standardHoursByStaffId: Record<string, StaffStandardHoursDayInput[]>;
  eligibleStaffIds: readonly string[];
}): Array<{ id: string; name: string }> {
  return listStaffMissingStandardHoursForRoster(
    input.staffOptions,
    input.standardHoursByStaffId,
    input.eligibleStaffIds
  );
}
