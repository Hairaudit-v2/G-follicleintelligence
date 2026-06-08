import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";

/** Bookings whose interval overlaps the clinic-local lane for `dayKey`. */
export function bookingsOverlappingDayKey(rows: FiBookingRow[], lanes: CalendarDayLane[], dayKey: string): FiBookingRow[] {
  const lane = lanes.find((l) => l.dayKey === dayKey.trim());
  if (!lane) return [];
  return rows.filter((b) => {
    const s = Date.parse(b.start_at);
    const e = Date.parse(b.end_at);
    return Number.isFinite(s) && Number.isFinite(e) && s < lane.endMs && e > lane.startMs;
  });
}

export type FiOsTodayStripCounts = {
  all: number;
  consultation: number;
  prp: number;
  surgery: number;
  arrived: number;
  waiting: number;
  completed: number;
  unassigned: number;
};

/** Counts for the selected anchor day (cancelled excluded, completed included). */
export function computeFiOsTodayStripCounts(dayRows: FiBookingRow[]): FiOsTodayStripCounts {
  const rows = dayRows.filter((b) => !isBookingCancelled(b));
  const all = rows.length;
  const consultation = rows.filter((b) => b.booking_type.trim() === "consultation").length;
  const prp = rows.filter((b) => b.booking_type.trim() === "prp").length;
  const surgery = rows.filter((b) => b.booking_type.trim() === "surgery").length;
  const arrived = rows.filter((b) => b.booking_status.trim() === "arrived").length;
  const waiting = rows.filter((b) => {
    const st = b.booking_status.trim();
    return st === "scheduled" || st === "confirmed";
  }).length;
  const completed = rows.filter((b) => b.booking_status.trim() === "completed").length;
  const unassigned = rows.filter((b) => !b.assigned_staff_id?.trim() && !b.assigned_user_id?.trim()).length;
  return { all, consultation, prp, surgery, arrived, waiting, completed, unassigned };
}
