/**
 * Unassigned / exception-lane labels for operational calendar resource columns.
 * Prefer specific wording over a generic "Unassigned" that obscures what is missing.
 */

import type { CalendarResourceView } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  resolveDisplayResourceColumnId,
} from "@/src/lib/calendar/operationalCalendarLayout";
import type { OperationalCalendarResourceColumn } from "@/src/lib/calendar/operationalCalendarTypes";

export type UnassignedResourceColumnCopy = {
  label: string;
  subtitle: string | null;
};

export function unassignedResourceColumnCopy(
  resourceView: CalendarResourceView
): UnassignedResourceColumnCopy {
  if (resourceView === "clinic") {
    return { label: "No clinic", subtitle: "Clinic not set on appointment" };
  }
  if (resourceView === "room") {
    return { label: "Room unassigned", subtitle: "No room allocated" };
  }
  return { label: "Clinician unassigned", subtitle: "No staff column" };
}

export function buildUnassignedResourceColumn(
  resourceView: CalendarResourceView
): OperationalCalendarResourceColumn {
  const copy = unassignedResourceColumnCopy(resourceView);
  return {
    id: "unassigned",
    kind: "unassigned",
    label: copy.label,
    subtitle: copy.subtitle,
  };
}

/**
 * True when at least one booking would place into the unassigned lane for this view.
 * Used so an empty "No clinic" / "Clinician unassigned" column does not inflate grid width.
 */
export function bookingNeedsUnassignedResourceColumn(
  booking: FiBookingRow,
  opts: {
    resourceView: CalendarResourceView;
    staffIdByUserId?: Map<string, string>;
    /** Ideal→display resolution against columns that exclude `unassigned`. */
    primaryColumnIds: ReadonlySet<string> | readonly string[];
  }
): boolean {
  const ids =
    opts.primaryColumnIds instanceof Set
      ? opts.primaryColumnIds
      : new Set(opts.primaryColumnIds);
  const display = resolveDisplayResourceColumnId(booking, ids, {
    resourceView: opts.resourceView,
    staffIdByUserId: opts.staffIdByUserId,
  });
  return display === "unassigned";
}

/**
 * Append the unassigned exception lane only when something would land there.
 * When empty, omit it so clinic grids are not doubled by a permanent empty column.
 */
export function appendUnassignedResourceColumnIfNeeded(
  columns: OperationalCalendarResourceColumn[],
  bookings: readonly FiBookingRow[],
  opts: {
    resourceView: CalendarResourceView;
    staffIdByUserId?: Map<string, string>;
  }
): OperationalCalendarResourceColumn[] {
  const without = columns.filter((c) => c.id !== "unassigned");
  const primaryIds = without.map((c) => c.id);
  const needed = bookings.some((b) =>
    bookingNeedsUnassignedResourceColumn(b, {
      resourceView: opts.resourceView,
      staffIdByUserId: opts.staffIdByUserId,
      primaryColumnIds: primaryIds,
    })
  );
  if (!needed) return without;
  return [...without, buildUnassignedResourceColumn(opts.resourceView)];
}
