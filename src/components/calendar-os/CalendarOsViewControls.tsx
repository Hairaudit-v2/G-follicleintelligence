"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarRoute,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import type { CalendarOsViewMode } from "@/src/lib/calendar-os/calendarResourceModel";
import { cn } from "@/lib/utils";

const PRIMARY_VIEW_MODES: { id: CalendarOsViewMode; label: string }[] = [
  { id: "staff", label: "Staff" },
  { id: "room", label: "Rooms" },
  { id: "surgery", label: "Surgery" },
  { id: "consultations", label: "Consult" },
];

const MORE_VIEW_MODES: { id: CalendarOsViewMode; label: string }[] = [
  { id: "prp", label: "PRP" },
  { id: "follow_up", label: "Follow-up" },
  { id: "doctor", label: "Doctors" },
  { id: "nurse", label: "Nurses" },
  { id: "clinic", label: "Clinic" },
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
      return buildCalendarHref(tenantId, mergeCalendarHrefQuery(query, cleared), { route });
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
      return query.resourceView === "staff" && !type && !query.staffRoleBucket;
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

function viewChipClass(active: boolean) {
  return cn(
    "rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
    active
      ? "border-cyan-500/35 bg-cyan-500/12 text-cyan-100"
      : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:border-white/12 hover:text-slate-300"
  );
}

export type CalendarOsViewControlsProps = {
  tenantId: string;
  query: ParsedCalendarQuery;
  route?: CalendarRoute;
  inline?: boolean;
};

export function CalendarOsViewControls({
  tenantId,
  query,
  route = "fi-admin",
  inline = false,
}: CalendarOsViewControlsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_VIEW_MODES.some((m) => isViewModeActive(query, m.id));
  const activeMore = MORE_VIEW_MODES.find((m) => isViewModeActive(query, m.id));

  return (
    <div className={cn("flex flex-wrap items-center gap-1", !inline && "px-0")}>
      {PRIMARY_VIEW_MODES.map((mode) => {
        const active = isViewModeActive(query, mode.id);
        return (
          <a
            key={mode.id}
            href={viewModeHref(tenantId, query, mode.id, route)}
            className={viewChipClass(active)}
          >
            {mode.label}
          </a>
        );
      })}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            viewChipClass(moreActive),
            "inline-flex items-center gap-0.5"
          )}
          aria-expanded={moreOpen}
        >
          {activeMore ? activeMore.label : "More"}
          <ChevronDown className={cn("h-2.5 w-2.5 transition", moreOpen && "rotate-180")} aria-hidden />
        </button>
        {moreOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[8] cursor-default"
              aria-label="Close view menu"
              onClick={() => setMoreOpen(false)}
            />
            <div className="absolute left-0 top-full z-[9] mt-0.5 min-w-[7rem] rounded border border-white/[0.1] bg-[#060d18] py-0.5 shadow-lg shadow-black/40">
              {MORE_VIEW_MODES.map((mode) => (
                <a
                  key={mode.id}
                  href={viewModeHref(tenantId, query, mode.id, route)}
                  className={cn(
                    "block px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/[0.04]",
                    isViewModeActive(query, mode.id) ? "text-cyan-200" : "text-slate-400"
                  )}
                  onClick={() => setMoreOpen(false)}
                >
                  {mode.label}
                </a>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}