import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import { isUuidTruncationDisplayLabel } from "@/src/lib/bookings/bookingDisplayName";
import type { FiBookingRow } from "@/src/lib/bookings/types";

/** Keep client-upserted rows when a soft refresh omits them (e.g. active staff/clinic URL filters). */
export function mergeCalendarBookingsOnHydrate(
  serverBookings: FiBookingRow[],
  clientBookings: FiBookingRow[]
): FiBookingRow[] {
  const byId = new Map(serverBookings.map((b) => [b.id, b]));
  for (const local of clientBookings) {
    if (!byId.has(local.id)) byId.set(local.id, local);
  }
  return Array.from(byId.values()).sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
}

export function mergeCalendarBookingDisplayOnHydrate(
  serverDisplay: Record<string, OperationalCalendarBookingDisplay>,
  clientDisplay: Record<string, OperationalCalendarBookingDisplay>,
  mergedBookings: FiBookingRow[]
): Record<string, OperationalCalendarBookingDisplay> {
  const out = { ...serverDisplay };
  for (const row of mergedBookings) {
    const clientHint = clientDisplay[row.id];
    const serverHint = serverDisplay[row.id];
    if (clientHint && !serverHint) {
      out[row.id] = clientHint;
      continue;
    }
    if (clientHint && serverHint && isUuidTruncationDisplayLabel(serverHint.anchorLabel)) {
      out[row.id] = { ...serverHint, anchorLabel: clientHint.anchorLabel };
    }
  }
  return out;
}
