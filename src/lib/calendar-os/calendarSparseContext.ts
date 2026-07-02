/**
 * CalendarOS V2 — sparse calendar empty-state context (pure).
 */

import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import { isBookingUnassignedForCalendarOs } from "@/src/lib/calendar-os/calendarResourceModel";

export type CalendarOsSparseContext = {
  totalBookings: number;
  availableStaffCount: number;
  openRoomsCount: number;
  unassignedCount: number;
  followUpCount: number;
  availableStaffNames: string[];
  openRoomNames: string[];
  suggestedActions: string[];
};

export function buildCalendarOsSparseContext(input: {
  bookings: FiBookingRow[];
  staffDirectory: ClinicalStaffPickerOption[];
  rooms: FiClinicRoomRow[];
  dayKeys: string[];
}): CalendarOsSparseContext {
  const { bookings, staffDirectory, rooms, dayKeys } = input;
  const daySet = new Set(dayKeys);

  const scoped = bookings.filter((b) => {
    const ms = Date.parse(b.start_at);
    if (!Number.isFinite(ms)) return false;
    const key = new Date(ms).toISOString().slice(0, 10);
    return daySet.has(key) || dayKeys.some((dk) => b.start_at.startsWith(dk));
  });

  const availableStaff = staffDirectory.filter(
    (s) => s.is_active !== false && s.clinical_readiness?.clinically_available !== false
  );
  const openRooms = rooms.filter((r) => r.is_active !== false);

  const unassignedCount = scoped.filter((b) => isBookingUnassignedForCalendarOs(b)).length;
  const followUpCount = scoped.filter(
    (b) => b.booking_type === "follow_up" || b.booking_type === "review"
  ).length;

  const suggestedActions: string[] = [];
  if (unassignedCount > 0) {
    suggestedActions.push(`${unassignedCount} booking${unassignedCount === 1 ? "" : "s"} need assignment`);
  }
  if (followUpCount > 0) {
    suggestedActions.push(`${followUpCount} follow-up${followUpCount === 1 ? "" : "s"} scheduled`);
  }
  if (scoped.length === 0 && availableStaff.length > 0) {
    suggestedActions.push(`${availableStaff.length} clinicians available — open capacity`);
  }
  if (openRooms.length > 0 && scoped.length < openRooms.length) {
    suggestedActions.push(`${openRooms.length - scoped.length} room slots potentially free`);
  }
  if (suggestedActions.length === 0) {
    suggestedActions.push("Calendar is clear — good window for admin or walk-ins");
  }

  return {
    totalBookings: scoped.length,
    availableStaffCount: availableStaff.length,
    openRoomsCount: openRooms.length,
    unassignedCount,
    followUpCount,
    availableStaffNames: availableStaff
      .map((s) => String(s.full_name ?? "").trim())
      .filter(Boolean)
      .slice(0, 5),
    openRoomNames: openRooms
      .map((r) => r.display_name?.trim() || r.room_code?.trim() || "Room")
      .slice(0, 5),
    suggestedActions: suggestedActions.slice(0, 4),
  };
}
