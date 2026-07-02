"use client";

import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarRoute,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import type { CalendarOsViewMode } from "@/src/lib/calendar-os/calendarResourceModel";
import { cn } from "@/lib/utils";

const VIEW_MODES: { id: CalendarOsViewMode; label: string }[] = [
  { id: "staff", label: "Staff" },
  { id: "room", label: "Rooms" },
  { id: "clinic", label: "Clinic" },
  { id: "consultations", label: "Consultations" },
  { id: "prp", label: "PRP" },
  { id: "surgery", label: "Surgery" },
  { id: "follow_up", label: "Follow-up" },
  { id: "doctor", label: "Doctors" },
  { id: "nurse", label: "Nurses" },
  { id: "clinic_room", label: "Clinic room" },
];

function viewModeHref(
  tenantId: string,
  query: ParsedCalendarQuery,
  mode: CalendarOsViewMode,
  route: CalendarRoute
): string {
  const cleared = {
    type: null as string | null,
    role: null as ParsedCalendarQuery["staffRoleBucket"],
    resourceView: "staff" as const,
    roomId: null as string | null,
  };

  switch (mode) {
    case "staff":
      return buildCalendarHref(
        tenantId,
        mergeCalendarHrefQuery(query, cleared),
        { route }
      );
    case "room":
      return buildCalendarHref(
        tenantId,
        mergeCalendarHrefQuery(query, {
          ...cleared,
          resourceView: "room",
          view: query.view === "month" ? "week" : query.view,
        }),
        { route }
      );
    case "clinic":
      return buildCalendarHref(
        tenantId,
        mergeCalendarHrefQuery(query, { ...cleared, resourceView: "clinic" }),
        { route }
      );
    case "consultations":
      return buildCalendarHref(
        tenantId,
        mergeCalendarHrefQuery(query, { ...cleared, type: "consultation" }),
        { route }
      );
    case "prp":
      return buildCalendarHref(
        tenantId,
        mergeCalendarHrefQuery(query, { ...cleared, type: "prp" }),
        { route }
      );
    case "surgery":
      return buildCalendarHref(
        tenantId,
        mergeCalendarHrefQuery(query, { ...cleared, type: "surgery" }),
        { route }
      );
    case "follow_up":
      return buildCalendarHref(
        tenantId,
        mergeCalendarHrefQuery(query, { ...cleared, type: "follow_up" }),
        { route }
      );
    case "doctor":
      return buildCalendarHref(
        tenantId,
        mergeCalendarHrefQuery(query, { ...cleared, role: "doctor" }),
        { route }
      );
    case "nurse":
      return buildCalendarHref(
        tenantId,
        mergeCalendarHrefQuery(query, { ...cleared, role: "nurse" }),
        { route }
      );
    case "clinic_room":
      return buildCalendarHref(
        tenantId,
        mergeCalendarHrefQuery(query, { ...cleared, resourceView: "room", view: "day" }),
        { route }
      );
    default:
      return buildCalendarHref(tenantId, mergeCalendarHrefQuery(query, cleared), { route });
  }
}

function isViewModeActive(query: ParsedCalendarQuery, mode: CalendarOsViewMode): boolean {
  const type = query.bookingType?.trim().toLowerCase();
  switch (mode) {
    case "staff":
      return (
        query.resourceView === "staff" &&
        !type &&
        !query.staffRoleBucket
      );
    case "room":
      return query.resourceView === "room" && !query.roomId;
    case "clinic":
      return query.resourceView === "clinic";
    case "consultations":
      return type === "consultation";
    case "prp":
      return type === "prp";
    case "surgery":
      return type === "surgery";
    case "follow_up":
      return type === "follow_up";
    case "doctor":
      return query.staffRoleBucket === "doctor";
    case "nurse":
      return query.staffRoleBucket === "nurse";
    case "clinic_room":
      return query.resourceView === "room" && query.view === "day";
    default:
      return false;
  }
}

export type CalendarOsViewControlsProps = {
  tenantId: string;
  query: ParsedCalendarQuery;
  route?: CalendarRoute;
};

export function CalendarOsViewControls({
  tenantId,
  query,
  route = "fi-admin",
}: CalendarOsViewControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.06] bg-[#081020]/80 px-3 py-2">
      <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        View
      </span>
      {VIEW_MODES.map((mode) => {
        const active = isViewModeActive(query, mode.id);
        return (
          <a
            key={mode.id}
            href={viewModeHref(tenantId, query, mode.id, route)}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
              active
                ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-slate-200"
            )}
          >
            {mode.label}
          </a>
        );
      })}
    </div>
  );
}
