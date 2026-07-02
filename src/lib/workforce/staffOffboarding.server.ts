import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES,
  type StaffEmploymentStatus,
} from "@/src/lib/workforce-os/staffLifecycleTypes";
import { applyStaffDepartureSideEffects } from "@/src/lib/workforce/staffDepartureSideEffects.server";

import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

export type OffboardStaffMemberResult = {
  staffMemberId: string;
  fiStaffId: string | null;
  employmentStatus: string;
  futureBookingsUnassigned: number;
};

async function insertWorkforceAudit(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    staff_member_id: string;
    event_type: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_member_id,
    event_type: row.event_type,
    source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function loadOffboardingQueueCount(
  tenantId: string,
  client?: SupabaseClient
): Promise<number> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_staff_members")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .in("employment_status", ["terminated", "resigned", "contract_ended", "contract_expired"])
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadInactiveStaffCount(
  tenantId: string,
  client?: SupabaseClient
): Promise<number> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_staff_members")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .in("employment_status", [
      "inactive",
      "terminated",
      "resigned",
      "contract_ended",
      "contract_expired",
      "suspended",
      "merged",
    ])
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Offboards a staff member without deleting historical records.
 * Revokes permissions and access flags; preserves audit/compliance history.
 */
export async function offboardStaffMember(input: {
  tenantId: string;
  staffId: string;
  exitReason: string;
  employmentStatus?: StaffEmploymentStatus;
  terminatedBy?: string | null;
  departureSource?: "offboarding_centre" | "iiohr_hr";
  client?: SupabaseClient;
}): Promise<OffboardStaffMemberResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffId, "staffId");
  const exitReason = input.exitReason.trim();
  if (!exitReason) throw new Error("exitReason is required.");

  const employmentStatus = input.employmentStatus ?? "terminated";
  if (!OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES.has(employmentStatus)) {
    throw new Error(
      "employmentStatus must be terminated, resigned, or contract_ended for offboarding."
    );
  }

  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: loadError } = await supabase
    .from("fi_staff_members")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", staffMemberId)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new Error("Staff member not found.");

  const fiStaffId =
    (existing as { fi_staff_id?: string | null }).fi_staff_id != null
      ? String((existing as { fi_staff_id: string }).fi_staff_id)
      : null;

  const { error: updateError } = await supabase
    .from("fi_staff_members")
    .update({
      employment_status: employmentStatus,
      termination_date: now,
      exit_reason: exitReason,
      offboarded_by: input.terminatedBy ?? null,
      offboarded_at: now,
      system_access_revoked: true,
      academy_access_revoked: true,
      employment_status_reason: exitReason,
      employment_status_changed_at: now,
      employment_status_changed_by: input.terminatedBy ?? null,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", staffMemberId)
    .select("*")
    .single();
  if (updateError) throw new Error(updateError.message);

  if (fiStaffId) {
    const { error: fiStaffError } = await supabase
      .from("fi_staff")
      .update({
        employment_status: employmentStatus,
        is_active: false,
        employment_status_reason: exitReason,
        employment_status_changed_at: now,
        employment_status_changed_by: input.terminatedBy ?? null,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("id", fiStaffId);
    if (fiStaffError) throw new Error(fiStaffError.message);
  }

  let futureBookingsUnassigned = 0;

  if (fiStaffId) {
    const sideEffects = await applyStaffDepartureSideEffects({
      tenantId: tid,
      fiStaffId,
      terminatedBy: input.terminatedBy ?? null,
      now,
      client: supabase,
    });
    futureBookingsUnassigned =
      sideEffects.futureBookings.primaryUnassignedCount +
      sideEffects.futureBookings.resourceAssignmentsRemoved;

    if (sideEffects.futureBookings.affectedBookingIds.length > 0) {
      await insertWorkforceAudit(supabase, {
        tenant_id: tid,
        staff_member_id: staffMemberId,
        event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.FUTURE_BOOKINGS_UNASSIGNED_ON_OFFBOARD,
        metadata: {
          fi_staff_id: fiStaffId,
          primary_unassigned_count: sideEffects.futureBookings.primaryUnassignedCount,
          resource_assignments_removed: sideEffects.futureBookings.resourceAssignmentsRemoved,
          affected_booking_ids: sideEffects.futureBookings.affectedBookingIds,
          departure_source: input.departureSource ?? "offboarding_centre",
        },
      });
    }

    // TODO: SurgeryOS permission revocation table when dedicated grants ship.
    // TODO: Readiness recalculation job hook — tenant overview refresh is triggered by revalidation.
  }

  await insertWorkforceAudit(supabase, {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.STAFF_OFFBOARDED,
    metadata: {
      exit_reason: exitReason,
      terminated_by: input.terminatedBy ?? null,
      fi_staff_id: fiStaffId,
      employment_status: employmentStatus,
      system_access_revoked: true,
      academy_access_revoked: true,
      audit_history_preserved: true,
      future_bookings_unassigned: futureBookingsUnassigned,
      departure_source: input.departureSource ?? "offboarding_centre",
    },
  });

  return {
    staffMemberId,
    fiStaffId,
    employmentStatus,
    futureBookingsUnassigned,
  };
}
