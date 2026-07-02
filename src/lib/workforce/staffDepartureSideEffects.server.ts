import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { disableStaffPinForTenant } from "@/src/lib/staffPin/staffPin.server";

export type UnassignFutureBookingsResult = {
  primaryUnassignedCount: number;
  resourceAssignmentsRemoved: number;
  affectedBookingIds: string[];
};

/**
 * Clears future operational booking staff references for a departed staff member.
 * Past bookings are preserved unchanged; bookings are not cancelled or deleted.
 */
export async function unassignFutureBookingsForStaff(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    fiStaffId: string;
    now?: string;
  }
): Promise<UnassignFutureBookingsResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const fiStaffId = assertNonEmptyUuid(input.fiStaffId, "fiStaffId");
  const now = input.now ?? new Date().toISOString();

  const { data: primaryBookings, error: primaryError } = await supabase
    .from("fi_bookings")
    .select("id")
    .eq("tenant_id", tid)
    .eq("assigned_staff_id", fiStaffId)
    .gte("start_at", now)
    .neq("booking_status", "cancelled");
  if (primaryError) throw new Error(primaryError.message);

  const primaryIds = ((primaryBookings ?? []) as { id: string }[]).map((b) => String(b.id));

  if (primaryIds.length > 0) {
    const { error: unassignError } = await supabase
      .from("fi_bookings")
      .update({ assigned_staff_id: null, updated_at: now })
      .eq("tenant_id", tid)
      .in("id", primaryIds);
    if (unassignError) throw new Error(unassignError.message);
  }

  const { data: resourceRows, error: resourceError } = await supabase
    .from("fi_booking_resource_assignments")
    .select("id, booking_id")
    .eq("tenant_id", tid)
    .eq("resource_type", "staff")
    .eq("resource_id", fiStaffId);
  if (resourceError) throw new Error(resourceError.message);

  const assignmentRows = (resourceRows ?? []) as { id: string; booking_id: string }[];
  const bookingIdsFromResources = [...new Set(assignmentRows.map((r) => String(r.booking_id)))];

  const futureResourceAssignmentIds: string[] = [];
  const futureResourceBookingIds: string[] = [];

  if (bookingIdsFromResources.length > 0) {
    const { data: futureBookings, error: futureError } = await supabase
      .from("fi_bookings")
      .select("id")
      .eq("tenant_id", tid)
      .in("id", bookingIdsFromResources)
      .gte("start_at", now)
      .neq("booking_status", "cancelled");
    if (futureError) throw new Error(futureError.message);

    const futureIdSet = new Set(
      ((futureBookings ?? []) as { id: string }[]).map((b) => String(b.id))
    );
    for (const row of assignmentRows) {
      if (futureIdSet.has(String(row.booking_id))) {
        futureResourceAssignmentIds.push(String(row.id));
        futureResourceBookingIds.push(String(row.booking_id));
      }
    }
  }

  if (futureResourceAssignmentIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("fi_booking_resource_assignments")
      .delete()
      .eq("tenant_id", tid)
      .in("id", futureResourceAssignmentIds);
    if (deleteError) throw new Error(deleteError.message);
  }

  const affectedBookingIds = [
    ...new Set([...primaryIds, ...futureResourceBookingIds]),
  ];

  return {
    primaryUnassignedCount: primaryIds.length,
    resourceAssignmentsRemoved: futureResourceAssignmentIds.length,
    affectedBookingIds,
  };
}

export type ApplyStaffDepartureSideEffectsResult = {
  futureBookings: UnassignFutureBookingsResult;
};

/**
 * Shared departure side effects: revoke access, cancel future shifts/assignments,
 * unassign future bookings, deactivate calendar links, disable PIN.
 */
export async function applyStaffDepartureSideEffects(input: {
  tenantId: string;
  fiStaffId: string;
  terminatedBy?: string | null;
  now?: string;
  client: SupabaseClient;
}): Promise<ApplyStaffDepartureSideEffectsResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const fiStaffId = assertNonEmptyUuid(input.fiStaffId, "fiStaffId");
  const supabase = input.client;
  const now = input.now ?? new Date().toISOString();

  await supabase
    .from("fi_staff_feature_access")
    .delete()
    .eq("tenant_id", tid)
    .eq("staff_id", fiStaffId);

  await supabase
    .from("fi_staff_access_grants")
    .update({ revoked_at: now, updated_at: now })
    .eq("tenant_id", tid)
    .eq("staff_member_id", fiStaffId)
    .is("revoked_at", null);

  await supabase
    .from("fi_staff_field_access_grants")
    .update({ revoked_at: now, updated_at: now })
    .eq("tenant_id", tid)
    .eq("staff_member_id", fiStaffId)
    .is("revoked_at", null);

  await supabase
    .from("fi_staff_shifts")
    .update({ status: "cancelled", updated_at: now })
    .eq("tenant_id", tid)
    .eq("staff_id", fiStaffId)
    .in("status", ["scheduled", "confirmed"]);

  await supabase
    .from("fi_staff_event_assignments")
    .update({ assignment_status: "cancelled", updated_at: now })
    .eq("tenant_id", tid)
    .eq("staff_id", fiStaffId)
    .in("assignment_status", ["scheduled", "confirmed"]);

  await supabase
    .from("fi_staff_calendar_links")
    .update({ is_active: false, updated_at: now })
    .eq("tenant_id", tid)
    .eq("staff_member_id", fiStaffId);

  const futureBookings = await unassignFutureBookingsForStaff(supabase, {
    tenantId: tid,
    fiStaffId,
    now,
  });

  await disableStaffPinForTenant({
    tenantId: tid,
    staffId: fiStaffId,
    actorFiUserId: input.terminatedBy ?? null,
    client: supabase,
  });

  return { futureBookings };
}
