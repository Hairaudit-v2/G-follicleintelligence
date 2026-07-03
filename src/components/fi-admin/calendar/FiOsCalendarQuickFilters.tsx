"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Filter } from "lucide-react";

import { CalendarTransitionLink } from "@/components/calendar/CalendarTransitionLink";
import { cn } from "@/lib/utils";
import { pushCalendarHref } from "@/lib/calendar/calendarRouterTransition";
import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarResourceView,
  type CalendarRoute,
  type CalendarStaffRoleBucket,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";
import {
  fiOsCalDesktopOnly,
  fiOsCalTabletChipScroll,
  fiOsCalTabletOnly,
} from "@/src/lib/calendar/fiOsCalendarResponsive";

const TYPE_CHIPS: { id: string; label: string; type: string }[] = [
  { id: "consultation", label: "Consultations", type: "consultation" },
  { id: "prp", label: "PRP", type: "prp" },
  { id: "surgery", label: "Surgery", type: "surgery" },
  { id: "follow_up", label: "Follow-up", type: "follow_up" },
];

export function FiOsCalendarQuickFilters({
  tenantId,
  query,
  clinics,
  route = "fi-admin",
}: {
  tenantId: string;
  query: ParsedCalendarQuery;
  clinics: CrmShellClinicOption[];
  route?: CalendarRoute;
}) {
  const router = useRouter();
  const [tabletOpen, setTabletOpen] = useState(false);
  const hrefOpts = { route };

  function typeHref(t: string): string {
    const active = query.bookingType?.trim() === t;
    return buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, { type: active ? null : t }),
      hrefOpts
    );
  }

  function roleHref(bucket: CalendarStaffRoleBucket): string {
    const active = query.staffRoleBucket === bucket && !query.staffId?.trim();
    return buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, {
        role: active ? null : bucket,
        staffId: null,
      }),
      hrefOpts
    );
  }

  const clinicChipActive = Boolean(query.clinicId?.trim());
  const firstClinicId = clinics[0]?.id;

  function onClinicRoomClick() {
    const href = buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, {
        clinicId: clinicChipActive ? null : (firstClinicId ?? null),
      }),
      hrefOpts
    );
    pushCalendarHref(router, href);
  }

  function resourceViewHref(view: CalendarResourceView): string {
    const active = query.resourceView === view;
    return buildCalendarHref(
      tenantId,
      mergeCalendarHrefQuery(query, {
        resourceView: active && view !== "staff" ? null : view,
      }),
      hrefOpts
    );
  }

  const chipClass = (active: boolean, accent?: "violet") =>
    cn(
      "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
      active
        ? accent === "violet"
          ? "border-violet-400/35 bg-violet-500/15 text-violet-100"
          : "border-cyan-400/40 bg-cyan-500/15 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.12)]"
        : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-cyan-500/25 hover:text-white"
    );

  const filterChips = (
    <>
      <CalendarTransitionLink href={resourceViewHref("staff")} className={chipClass(query.resourceView === "staff")}>
        By staff
      </CalendarTransitionLink>
      <CalendarTransitionLink href={resourceViewHref("room")} className={chipClass(query.resourceView === "room")}>
        By room
      </CalendarTransitionLink>
      <CalendarTransitionLink href={resourceViewHref("clinic")} className={chipClass(query.resourceView === "clinic")}>
        By clinic
      </CalendarTransitionLink>
      {TYPE_CHIPS.map((c) => {
        const active = query.bookingType?.trim() === c.type;
        return (
          <CalendarTransitionLink key={c.id} href={typeHref(c.type)} className={chipClass(active)}>
            {c.label}
          </CalendarTransitionLink>
        );
      })}
      <CalendarTransitionLink
        href={roleHref("doctor")}
        className={chipClass(query.staffRoleBucket === "doctor" && !query.staffId?.trim())}
      >
        Doctor
      </CalendarTransitionLink>
      <CalendarTransitionLink
        href={roleHref("nurse")}
        className={chipClass(query.staffRoleBucket === "nurse" && !query.staffId?.trim())}
      >
        Nurse
      </CalendarTransitionLink>
      <button
        type="button"
        onClick={onClinicRoomClick}
        disabled={!clinicChipActive && !firstClinicId}
        title={
          !firstClinicId && !clinicChipActive
            ? "No clinic sites configured"
            : clinicChipActive
              ? "Show all locations"
              : `Focus ${clinics[0]?.display_name ?? "first site"}`
        }
        className={cn(
          chipClass(clinicChipActive, "violet"),
          "disabled:cursor-not-allowed disabled:opacity-40"
        )}
      >
        Clinic room
      </button>
    </>
  );

  const stripStyle = {
    borderBottomColor: "var(--fi-cal-ws-strip-border, rgba(255, 255, 255, 0.06))",
    background: "var(--fi-cal-ws-strip-bg, rgb(6 13 24 / 0.8))",
  } as const;

  return (
    <>
      <div
        className={cn(
          fiOsCalTabletOnly,
          "border-b px-2 py-1.5 backdrop-blur-md sm:px-3",
          tabletOpen && "pb-2"
        )}
        style={stripStyle}
        data-testid="calendar-quick-filters-tablet"
      >
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left text-xs text-slate-400"
          aria-expanded={tabletOpen}
          onClick={() => setTabletOpen((v) => !v)}
        >
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Resource filters
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition", tabletOpen && "rotate-180")}
            aria-hidden
          />
        </button>
        {tabletOpen ? (
          <div className={cn("mt-1.5", fiOsCalTabletChipScroll)}>{filterChips}</div>
        ) : null}
      </div>

      <div
        className={cn(
          fiOsCalDesktopOnly,
          "hidden flex-wrap items-center gap-2 border-b px-3 py-2 backdrop-blur-md sm:px-4 xl:flex"
        )}
        style={stripStyle}
        data-testid="calendar-quick-filters-desktop"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fi-cal-ws-time-label,#64748b)]">
          Quick filters
        </span>
        {filterChips}
      </div>
    </>
  );
}
