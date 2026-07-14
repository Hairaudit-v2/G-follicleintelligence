import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { revokeStaffLoginAccess } from "@/src/lib/workforce/staffAccessCentre.server";
import {
  changeStaffEmploymentStatus,
  loadStaffMemberLifecycle,
} from "@/src/lib/workforce-os/staffLifecycle.server";
import { STAFF_LIFECYCLE_AUDIT_EVENTS } from "@/src/lib/workforce-os/staffLifecycleTypes";
import {
  localDateToLeaveRangeIso,
  type StaffLeaveBlockSnapshot,
  type StaffShiftSnapshot,
} from "@/src/lib/workforce/staffLeaveWorkflowCore";
import { createAvailabilityBlock } from "@/src/lib/workforce-os/workforceRostering.server";

const LIFECYCLE_SOURCE = "workforce_os_staff_lifecycle";

export type SetStaffMaternityLeaveInput = {
  tenantId: string;
  staffMemberId: string;
  startDate: string;
  expectedReturnDate: string;
  notes?: string | null;
  keepLoginAccess: boolean;
  pauseRosterEligibility: boolean;
  pauseStandardHours: boolean;
  actorUserId?: string | null;
  client?: SupabaseClient;
};

export type StaffLeaveContextData = {
  availabilityBlocks: StaffLeaveBlockSnapshot[];
  futureShifts: StaffShiftSnapshot[];
};

async function insertLeaveAudit(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    staff_member_id: string;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_member_id,
    event_type: "staff_maternity_leave_set",
    source: LIFECYCLE_SOURCE,
    metadata: row.metadata,
  });
  if (error) throw new Error(error.message);
}

export async function loadStaffLeaveContext(input: {
  tenantId: string;
  fiStaffId: string;
  client?: SupabaseClient;
}): Promise<StaffLeaveContextData> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffId = assertNonEmptyUuid(input.fiStaffId, "fiStaffId");
  const supabase = input.client ?? supabaseAdmin();
  const nowIso = new Date().toISOString();

  const [blocksRes, shiftsRes] = await Promise.all([
    supabase
      .from("fi_staff_availability_blocks")
      .select("id, block_type, starts_at, ends_at, status, reason")
      .eq("tenant_id", tid)
      .eq("staff_id", staffId)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: false }),
    supabase
      .from("fi_staff_shifts")
      .select("id, starts_at, ends_at, status")
      .eq("tenant_id", tid)
      .eq("staff_id", staffId)
      .neq("status", "cancelled")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true }),
  ]);

  if (blocksRes.error) throw new Error(blocksRes.error.message);
  if (shiftsRes.error) throw new Error(shiftsRes.error.message);

  return {
    availabilityBlocks: (blocksRes.data ?? []).map((row) => ({
      id: String(row.id),
      block_type: row.block_type as StaffLeaveBlockSnapshot["block_type"],
      starts_at: String(row.starts_at),
      ends_at: String(row.ends_at),
      status: row.status as string | null,
      reason: row.reason as string | null,
    })),
    futureShifts: (shiftsRes.data ?? []).map((row) => ({
      id: String(row.id),
      starts_at: String(row.starts_at),
      ends_at: String(row.ends_at),
      status: row.status as string | null,
    })),
  };
}

export async function setStaffMaternityLeave(
  input: SetStaffMaternityLeaveInput
): Promise<{ memberId: string; fiStaffId: string | null; blockId: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();

  const member = await loadStaffMemberLifecycle(tid, staffMemberId, supabase);
  if (!member) throw new Error("Staff member not found.");
  if (!member.fi_staff_id)
    throw new Error("Staff member is not linked to fi_staff — cannot set leave.");

  if (Date.parse(input.expectedReturnDate) < Date.parse(input.startDate)) {
    throw new Error("Expected return date must be on or after the start date.");
  }

  const { startsAt, endsAt } = localDateToLeaveRangeIso(input.startDate, input.expectedReturnDate);

  const reasonParts = ["maternity_leave"];
  if (input.notes?.trim()) reasonParts.push(input.notes.trim());
  const reason = reasonParts.join(" — ");

  if (input.pauseRosterEligibility) {
    await changeStaffEmploymentStatus({
      tenantId: tid,
      staffMemberId,
      change: {
        employment_status: "on_leave",
        reason,
        effective_date: startsAt,
        archive_from_active: false,
      },
      actorUserId: input.actorUserId ?? null,
      client: supabase,
    });
  }

  const block = await createAvailabilityBlock({
    tenantId: tid,
    staffId: member.fi_staff_id,
    blockType: "maternity_leave",
    startsAt,
    endsAt,
    reason,
    createdBy: input.actorUserId ?? null,
    client: supabase,
  });

  if (!input.keepLoginAccess) {
    await revokeStaffLoginAccess({
      tenantId: tid,
      staffMemberId,
      actorFiUserId: input.actorUserId ?? null,
      client: supabase,
    });
  }

  await insertLeaveAudit(supabase, {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    metadata: {
      actor_user_id: input.actorUserId ?? null,
      event: STAFF_LIFECYCLE_AUDIT_EVENTS.EMPLOYMENT_STATUS_CHANGED,
      leave_type: "maternity_leave",
      start_date: input.startDate,
      expected_return_date: input.expectedReturnDate,
      notes: input.notes?.trim() || null,
      keep_login_access: input.keepLoginAccess,
      pause_roster_eligibility: input.pauseRosterEligibility,
      pause_standard_hours: input.pauseStandardHours,
      availability_block_id: block.id,
    },
  });

  return {
    memberId: staffMemberId,
    fiStaffId: member.fi_staff_id,
    blockId: block.id,
  };
}
