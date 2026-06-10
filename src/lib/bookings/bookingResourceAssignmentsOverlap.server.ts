import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

export type BookingResourceAssignmentOverlapLite = {
  booking_id: string;
  resource_type: "staff" | "room";
  resource_id: string;
};

/**
 * Loads extra staff/room assignments for overlap checks (primary staff/room still live on `fi_bookings`).
 */
export async function loadBookingResourceAssignmentsOverlapByBooking(
  tenantId: string,
  bookingIds: string[],
  client?: SupabaseClient
): Promise<Map<string, BookingResourceAssignmentOverlapLite[]>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const ids = Array.from(new Set(bookingIds.map((x) => x.trim()).filter(Boolean)));
  const out = new Map<string, BookingResourceAssignmentOverlapLite[]>();
  if (ids.length === 0) return out;

  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_booking_resource_assignments")
    .select("booking_id, resource_type, resource_id")
    .eq("tenant_id", tid)
    .in("booking_id", ids);
  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const row = raw as { booking_id: string; resource_type: string; resource_id: string };
    const bid = String(row.booking_id);
    const rt = String(row.resource_type) === "room" ? "room" : "staff";
    const rid = String(row.resource_id ?? "").trim();
    if (!rid) continue;
    const list = out.get(bid) ?? [];
    list.push({ booking_id: bid, resource_type: rt, resource_id: rid });
    out.set(bid, list);
  }
  return out;
}
