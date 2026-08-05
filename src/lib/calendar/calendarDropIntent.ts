/**
 * FI-CALENDAR-WRITEBACK-1A — canonical calendar drop-intent resolver.
 *
 * Wraps resource-column assignee meta and time-slot resolution so drag handlers
 * preserve untouched values and clear only the intended dimension.
 */

import type { CalendarResourceView } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { assigneeMetaFromResourceColumnId } from "@/src/lib/calendar/operationalCalendarColumns";

export type CalendarDropTimeIntent = {
  startAt: string;
  endAt: string;
  /** True when the operator intentionally changed the time window. */
  timeChanged: boolean;
};

export type CalendarDropResourceIntent = {
  assignedStaffId?: string | null;
  assignedUserId?: string | null;
  clinicId?: string | null;
  roomId?: string | null;
  /** Dimensions explicitly touched by this drop (others must be preserved). */
  touched: ReadonlyArray<"clinician" | "clinic" | "room">;
};

export type CalendarDropIntent = {
  bookingId: string;
  time: CalendarDropTimeIntent;
  resources: CalendarDropResourceIntent;
  interactionSource: "calendar_drag";
};

export type ResolveCalendarDropIntentInput = {
  booking: Pick<
    FiBookingRow,
    | "id"
    | "start_at"
    | "end_at"
    | "assigned_staff_id"
    | "assigned_user_id"
    | "clinic_id"
    | "room_id"
  >;
  /** New UTC window from the drop (already snapped). */
  startAt: string;
  endAt: string;
  /** Target resource column id (`s:…`, `c:…`, `r:…`, `unassigned`, …). */
  columnId: string | null | undefined;
  staffIdByUserId: Map<string, string>;
  resourceView?: CalendarResourceView;
};

/**
 * Resolve a drag-drop into a precise mutation intent.
 *
 * Rules:
 * - Untouched fields are omitted from `resources` (callers must not null them out).
 * - Dropping onto clinician-unassigned clears clinicianId only and preserves clinicId.
 * - Clinic unassigned clears clinic only (via assigneeMetaFromResourceColumnId).
 */
export function resolveCalendarDropIntent(
  input: ResolveCalendarDropIntentInput
): CalendarDropIntent {
  const startAt = input.startAt.trim();
  const endAt = input.endAt.trim();
  const timeChanged =
    startAt !== input.booking.start_at.trim() || endAt !== input.booking.end_at.trim();

  const columnId = input.columnId?.trim() || "";
  const touched: Array<"clinician" | "clinic" | "room"> = [];
  const resources: CalendarDropResourceIntent = { touched };

  if (columnId) {
    const meta = assigneeMetaFromResourceColumnId(columnId, input.staffIdByUserId, {
      resourceView: input.resourceView,
    });

    if (Object.prototype.hasOwnProperty.call(meta, "assignedStaffId")) {
      resources.assignedStaffId = meta.assignedStaffId ?? null;
      touched.push("clinician");
    }
    if (Object.prototype.hasOwnProperty.call(meta, "assignedUserId")) {
      resources.assignedUserId = meta.assignedUserId ?? null;
      if (!touched.includes("clinician")) touched.push("clinician");
    }
    if (Object.prototype.hasOwnProperty.call(meta, "clinicId")) {
      resources.clinicId = meta.clinicId ?? null;
      touched.push("clinic");
    }
    if (columnId.startsWith("r:")) {
      resources.roomId = columnId.slice(2) || null;
      touched.push("room");
    }
  }

  return {
    bookingId: input.booking.id,
    time: { startAt, endAt, timeChanged },
    resources: { ...resources, touched },
    interactionSource: "calendar_drag",
  };
}

/**
 * Apply drop intent onto a booking snapshot for optimistic UI / PATCH body.
 * Preserves any field not listed in `touched`.
 */
export function applyCalendarDropIntentToBooking(
  booking: FiBookingRow,
  intent: CalendarDropIntent
): Pick<
  FiBookingRow,
  "start_at" | "end_at" | "assigned_staff_id" | "assigned_user_id" | "clinic_id" | "room_id"
> {
  const next = {
    start_at: intent.time.startAt,
    end_at: intent.time.endAt,
    assigned_staff_id: booking.assigned_staff_id,
    assigned_user_id: booking.assigned_user_id,
    clinic_id: booking.clinic_id,
    room_id: booking.room_id,
  };

  if (intent.resources.touched.includes("clinician")) {
    if (Object.prototype.hasOwnProperty.call(intent.resources, "assignedStaffId")) {
      next.assigned_staff_id = intent.resources.assignedStaffId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(intent.resources, "assignedUserId")) {
      next.assigned_user_id = intent.resources.assignedUserId ?? null;
    } else if (
      Object.prototype.hasOwnProperty.call(intent.resources, "assignedStaffId") &&
      intent.resources.assignedStaffId == null
    ) {
      next.assigned_user_id = null;
    }
  }

  if (intent.resources.touched.includes("clinic")) {
    next.clinic_id = intent.resources.clinicId ?? null;
  }

  if (intent.resources.touched.includes("room")) {
    next.room_id = intent.resources.roomId ?? null;
  }

  return next;
}

/** Re-export the resource-column helper as part of the canonical drop API. */
export { assigneeMetaFromResourceColumnId };
