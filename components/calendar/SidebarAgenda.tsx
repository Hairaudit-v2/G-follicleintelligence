"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { appointmentCardDataFromBooking } from "@/components/calendar/AppointmentCard";
import { Button } from "@/components/ui/button";
import { CalendarEmptyState } from "@/components/calendar/CalendarEmptyState";
import { getAppointmentStyle } from "@/lib/calendar/getAppointmentStyle";
import { calendarSidebarsCollapsedByDefault } from "@/lib/calendar/calendarResponsive";
import { useCalendarLayoutMode } from "@/hooks/useCalendarLayoutMode";
import { cn } from "@/lib/utils";
import { bookingStatusLabel } from "@/src/lib/bookings/operatorBookingLabels";
import { isBookingCancelled } from "@/src/lib/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import {
  addDaysToCalendarDate,
  addUtcMinutesToIso,
  bookingDurationMinutesUtc,
  calendarDateStringFromInstant,
  formatIsoTimeNumericInTimezone,
  localMondayStartMsContaining,
  normalizeCalendarTimezone,
  parseIsoUtcMs,
  utcNowIso,
  zonedMidnightUtcMs,
} from "@/src/lib/calendar/calendarTimezone";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

export const WAITLIST_DRAG_PREFIX = "waitlist:";

export type SidebarAgendaSection = "today" | "tomorrow" | "thisWeek";

export type SidebarWaitlistItem = {
  id: string;
  patientName: string;
  procedureType: string;
  procedureLabel?: string;
  /** Linked booking when scheduling from waitlist. */
  booking?: FiBookingRow;
  durationMin?: number;
  notes?: string | null;
};

export type SidebarAgendaGroups = Record<SidebarAgendaSection, FiBookingRow[]>;

const SECTION_LABELS: Record<SidebarAgendaSection, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This Week",
};

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "no_show"]);

export function partitionSidebarAgendaBookings(
  bookings: FiBookingRow[],
  now: Date = new Date(),
  calendarTimezone?: string | null
): SidebarAgendaGroups {
  const tz = normalizeCalendarTimezone(calendarTimezone);
  const todayKey = calendarDateStringFromInstant(now, tz);
  const tomorrowKey = addDaysToCalendarDate(todayKey, 1, tz);
  const startOfTodayMs = zonedMidnightUtcMs(todayKey, tz) ?? now.getTime();
  const mondayMs = localMondayStartMsContaining(startOfTodayMs, tz);
  const mondayKey = calendarDateStringFromInstant(new Date(mondayMs), tz);
  const sundayKey = addDaysToCalendarDate(mondayKey, 6, tz);

  const today: FiBookingRow[] = [];
  const tomorrow: FiBookingRow[] = [];
  const thisWeek: FiBookingRow[] = [];

  const sorted = [...bookings]
    .filter((b) => !isWaitlistBooking(b) && !isBookingCancelled(b) && !TERMINAL_STATUSES.has(b.booking_status))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  for (const booking of sorted) {
    const startMs = parseIsoUtcMs(booking.start_at);
    if (startMs == null) continue;
    const dayKey = calendarDateStringFromInstant(new Date(startMs), tz);

    if (dayKey === todayKey) {
      today.push(booking);
    } else if (dayKey === tomorrowKey) {
      tomorrow.push(booking);
    } else if (dayKey >= mondayKey && dayKey <= sundayKey && dayKey !== todayKey && dayKey !== tomorrowKey) {
      thisWeek.push(booking);
    }
  }

  return { today, tomorrow, thisWeek };
}

function isWaitlistBooking(booking: FiBookingRow): boolean {
  const meta = booking.metadata ?? {};
  return meta.waitlist === true || meta.waitlist === "true" || meta.on_waitlist === true;
}

export function deriveWaitlistFromBookings(bookings: FiBookingRow[]): SidebarWaitlistItem[] {
  return bookings
    .filter((b) => isWaitlistBooking(b) && !isBookingCancelled(b) && !TERMINAL_STATUSES.has(b.booking_status))
    .map((b) => {
      const meta = b.metadata ?? {};
      const durationMin = bookingDurationMinutesUtc(b.start_at, b.end_at) ?? 30;
      return {
        id: b.id,
        patientName: b.title?.trim() || "Patient",
        procedureType: b.booking_type,
        booking: b,
        durationMin,
        notes: typeof meta.waitlist_notes === "string" ? meta.waitlist_notes : null,
      };
    });
}

export function waitlistDragId(id: string): string {
  return `${WAITLIST_DRAG_PREFIX}${id}`;
}

export function parseWaitlistDragId(activeId: string): string | null {
  if (!activeId.startsWith(WAITLIST_DRAG_PREFIX)) return null;
  const id = activeId.slice(WAITLIST_DRAG_PREFIX.length);
  return id.trim() || null;
}

// ---------------------------------------------------------------------------
// Mini cards
// ---------------------------------------------------------------------------

function AgendaMiniCard({
  booking,
  label,
  clinicTimeZone,
  onClick,
}: {
  booking: FiBookingRow;
  label: string;
  clinicTimeZone?: string | null;
  onClick?: () => void;
}) {
  const appointmentStyle = getAppointmentStyle({
    procedureType: booking.booking_type,
    status: booking.booking_status,
    isVirtual: Boolean(booking.metadata?.is_virtual ?? booking.metadata?.virtual),
  });
  const accent = appointmentStyle.accentClass;
  const procedure = appointmentStyle.procedureLabel;
  const durMin = bookingDurationMinutesUtc(booking.start_at, booking.end_at) ?? 0;
  const tzKey = normalizeCalendarTimezone(clinicTimeZone ?? booking.timezone);

  const className = cn(
    "group relative w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-left shadow-sm transition",
    onClick && "hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
  );

  const inner = (
    <>
      <span aria-hidden className={cn("absolute inset-y-2 left-0 w-1 rounded-full", accent)} />
      <div className="pl-2">
        <p className="truncate text-[13px] font-semibold tracking-tight text-slate-900">{label}</p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{procedure}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            {formatIsoTimeNumericInTimezone(booking.start_at, tzKey)}
            {durMin > 0 ? ` · ${durMin}m` : ""}
          </span>
          <span className="truncate font-medium text-slate-600">{bookingStatusLabel(booking.booking_status)}</span>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

function WaitlistMiniCard({
  item,
  draggable,
}: {
  item: SidebarWaitlistItem;
  draggable: boolean;
}) {
  const appointmentStyle = getAppointmentStyle({
    procedureType: item.procedureType,
    status: item.booking?.booking_status ?? "scheduled",
    procedureLabel: item.procedureLabel,
  });
  const accent = appointmentStyle.accentClass;
  const procedure = appointmentStyle.procedureLabel;
  const dragId = waitlistDragId(item.booking?.id ?? item.id);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    disabled: !draggable,
    data: {
      type: "waitlist",
      item,
      appointment: item.booking
        ? appointmentCardDataFromBooking(item.booking, { anchorLabel: item.patientName, durationMin: item.durationMin })
        : {
            id: item.id,
            patientName: item.patientName,
            procedureType: item.procedureType,
            procedureLabel: procedure,
            startAt: utcNowIso(),
            endAt: addUtcMinutesToIso(utcNowIso(), item.durationMin ?? 30),
            durationMin: item.durationMin ?? 30,
            status: "scheduled",
          },
    },
  });

  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed border-slate-300/90 bg-slate-50/80 px-2.5 py-2 transition",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "z-10 opacity-60 shadow-md ring-2 ring-sky-300/50"
      )}
      {...(draggable ? { ...listeners, ...attributes } : {})}
    >
      <span aria-hidden className={cn("absolute inset-y-2 left-0 w-1 rounded-full", accent)} />
      <div className="flex items-start gap-2 pl-2">
        {draggable ? (
          <GripVertical className="fi-calendar-touch-target mt-0.5 h-4 w-4 shrink-0 text-slate-400 sm:h-3.5 sm:w-3.5" aria-hidden />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-900">{item.patientName}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{procedure}</p>
          {item.notes ? (
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-500">{item.notes}</p>
          ) : null}
          {draggable ? (
            <p className="mt-1.5 text-[10px] font-medium text-sky-700">Drag to calendar to schedule</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AgendaSection({
  title,
  count,
  children,
  emptyLabel,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  emptyLabel: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <CalendarEmptyState
          preset="agenda"
          description={emptyLabel}
          compact
          className="rounded-lg border border-dashed border-slate-200/80 bg-white/60"
        />
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// SidebarAgenda
// ---------------------------------------------------------------------------

export type SidebarAgendaProps = {
  bookings: FiBookingRow[];
  bookingDisplay?: Record<string, OperationalCalendarBookingDisplay>;
  /** Tenant clinic clock (`fi_tenant_settings.default_timezone`). */
  calendarTimezone?: string | null;
  waitlist?: SidebarWaitlistItem[];
  addAppointmentHref?: string;
  onAddAppointment?: () => void;
  onSelectBooking?: (booking: FiBookingRow) => void;
  draggableWaitlist?: boolean;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  /** When true, never use the full-screen compact overlay (parent provides the drawer chrome). */
  disableMobileOverlay?: boolean;
};

export function SidebarAgenda({
  bookings,
  bookingDisplay = {},
  calendarTimezone,
  waitlist: waitlistProp,
  addAppointmentHref,
  onAddAppointment,
  onSelectBooking,
  draggableWaitlist = true,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  className,
  disableMobileOverlay = false,
}: SidebarAgendaProps) {
  const layoutMode = useCalendarLayoutMode();
  const collapseByDefault = defaultCollapsed ?? calendarSidebarsCollapsedByDefault(layoutMode);
  const [collapsedUncontrolled, setCollapsedUncontrolled] = useState(collapseByDefault);
  const collapsed = collapsedProp ?? collapsedUncontrolled;

  useEffect(() => {
    if (collapsedProp !== undefined || defaultCollapsed !== undefined) return;
    if (calendarSidebarsCollapsedByDefault(layoutMode)) {
      setCollapsedUncontrolled(true);
    }
  }, [collapsedProp, defaultCollapsed, layoutMode]);

  const setCollapsed = (next: boolean) => {
    if (collapsedProp === undefined) setCollapsedUncontrolled(next);
    onCollapsedChange?.(next);
  };

  const groups = useMemo(
    () => partitionSidebarAgendaBookings(bookings, new Date(), calendarTimezone),
    [bookings, calendarTimezone]
  );
  const waitlist = waitlistProp ?? deriveWaitlistFromBookings(bookings);

  const totalUpcoming = groups.today.length + groups.tomorrow.length + groups.thisWeek.length;

  const addButton = addAppointmentHref ? (
    <Link
      href={addAppointmentHref}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
    >
      <Plus className="h-4 w-4" aria-hidden />
      Add appointment
    </Link>
  ) : (
    <Button
      type="button"
      onClick={onAddAppointment}
      className="h-auto w-full gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold hover:bg-slate-800"
    >
      <Plus className="h-4 w-4" aria-hidden />
      Add appointment
    </Button>
  );

  const isMobileOverlay = !disableMobileOverlay && !collapsed && layoutMode === "compact";

  if (collapsed) {
    return (
      <aside
        className={cn(
          "flex w-12 shrink-0 flex-col items-center gap-3 border-r border-slate-200/80 bg-white py-3 sm:w-14 sm:py-4",
          className
        )}
        aria-label="Agenda sidebar"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Expand agenda sidebar"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
        <CalendarDays className="h-5 w-5 text-slate-400" aria-hidden />
        {addAppointmentHref ? (
          <Link
            href={addAppointmentHref}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="Add appointment"
          >
            <Plus className="h-5 w-5" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAddAppointment}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="Add appointment"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
        <span className="mt-auto rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold tabular-nums text-slate-600">
          {totalUpcoming}
        </span>
      </aside>
    );
  }

  return (
    <>
      {isMobileOverlay ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
          aria-label="Close agenda"
          onClick={() => setCollapsed(true)}
        />
      ) : null}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-slate-200/80 bg-[#fafbfc]",
          isMobileOverlay
            ? "fixed inset-y-0 left-0 z-40 w-[min(100vw-2.5rem,17.5rem)] shadow-2xl"
            : "w-[min(100%,17.5rem)]",
          className
        )}
        aria-label="Agenda sidebar"
      >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Agenda</p>
          <p className="truncate text-sm font-semibold text-slate-900">{totalUpcoming} upcoming</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-800"
          aria-label="Collapse agenda sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div>{addButton}</div>

        {(Object.keys(SECTION_LABELS) as SidebarAgendaSection[]).map((section) => {
          const rows = groups[section];
          return (
            <AgendaSection
              key={section}
              title={SECTION_LABELS[section]}
              count={rows.length}
              emptyLabel={`No appointments ${section === "today" ? "today" : section === "tomorrow" ? "tomorrow" : "this week"}.`}
            >
              {rows.map((booking) => {
                const label = bookingDisplay[booking.id]?.anchorLabel ?? booking.title?.trim() ?? "Patient";
                return (
                  <AgendaMiniCard
                    key={booking.id}
                    booking={booking}
                    label={label}
                    clinicTimeZone={calendarTimezone}
                    onClick={onSelectBooking ? () => onSelectBooking(booking) : undefined}
                  />
                );
              })}
            </AgendaSection>
          );
        })}

        <section className="space-y-2 border-t border-slate-200/70 pt-4">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Waitlist</h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-800 ring-1 ring-amber-200/80">
              {waitlist.length}
            </span>
          </div>
          <p className="px-0.5 text-[11px] leading-relaxed text-slate-500">
            Patients awaiting a slot. Drag onto the calendar to schedule.
          </p>
          {waitlist.length === 0 ? (
            <CalendarEmptyState preset="waitlist" compact className="rounded-lg border border-dashed border-amber-200/70 bg-amber-50/40" />
          ) : (
            <div className="space-y-2">
              {waitlist.map((item) => (
                <WaitlistMiniCard key={item.id} item={item} draggable={draggableWaitlist} />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="border-t border-slate-200/70 px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-800"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Collapse
          <ChevronRight className="h-3.5 w-3.5 rotate-180" aria-hidden />
        </button>
      </div>
    </aside>
    </>
  );
}
