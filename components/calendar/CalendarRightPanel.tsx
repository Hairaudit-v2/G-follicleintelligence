"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen, Search } from "lucide-react";

import { CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT } from "@/src/lib/fiAdmin/clinicOsShellSearchEvent";
import { calendarSidebarsCollapsedByDefault } from "@/lib/calendar/calendarResponsive";
import { useCalendarLayoutMode } from "@/hooks/useCalendarLayoutMode";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import {
  calendarDateStringFromInstant,
  normalizeCalendarTimezone,
  parseIsoUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import { cn } from "@/lib/utils";

export type CalendarDailyStats = {
  total: number;
  confirmed: number;
  arrived: number;
  consultations: number;
  surgery: number;
  prp: number;
  waitlist: number;
};

export function computeCalendarDailyStats(
  bookings: FiBookingRow[],
  dayKey: string,
  calendarTimezone: string
): CalendarDailyStats {
  const tz = normalizeCalendarTimezone(calendarTimezone);
  const stats: CalendarDailyStats = {
    total: 0,
    confirmed: 0,
    arrived: 0,
    consultations: 0,
    surgery: 0,
    prp: 0,
    waitlist: 0,
  };

  for (const b of bookings) {
    const meta = b.metadata ?? {};
    if (meta.waitlist === true || meta.waitlist === "true" || meta.on_waitlist === true) {
      stats.waitlist += 1;
      continue;
    }

    const startMs = parseIsoUtcMs(b.start_at);
    if (startMs == null) continue;
    const key = calendarDateStringFromInstant(new Date(startMs), tz);
    if (key !== dayKey) continue;
    if (b.booking_status === "cancelled" || b.booking_status === "completed" || b.booking_status === "no_show") {
      continue;
    }

    stats.total += 1;
    if (b.booking_status === "confirmed") stats.confirmed += 1;
    if (b.booking_status === "arrived") stats.arrived += 1;
    if (b.booking_type === "consultation") stats.consultations += 1;
    if (b.booking_type === "surgery") stats.surgery += 1;
    if (b.booking_type === "prp" || b.booking_type === "prf") stats.prp += 1;
  }

  return stats;
}

type PanelTab = "search" | "stats";

export function CalendarRightPanel({
  bookings,
  bookingDisplay,
  dayKey,
  calendarTimezone,
  searchQuery,
  onSearchSubmit,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  className,
  forceOsDrawer = false,
}: {
  bookings: FiBookingRow[];
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  /** Clinic-local calendar day (`YYYY-MM-DD`) matching the visible anchor. */
  dayKey: string;
  calendarTimezone: string;
  searchQuery?: string;
  onSearchSubmit: (q: string) => void;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  forceOsDrawer?: boolean;
}) {
  const layoutMode = useCalendarLayoutMode();
  const collapseByDefault = defaultCollapsed ?? calendarSidebarsCollapsedByDefault(layoutMode);
  const [collapsedUncontrolled, setCollapsedUncontrolled] = useState(collapseByDefault);
  const [tab, setTab] = useState<PanelTab>("stats");
  const [localQ, setLocalQ] = useState(searchQuery ?? "");

  const collapsed = collapsedProp ?? collapsedUncontrolled;

  useEffect(() => {
    if (collapsedProp !== undefined || defaultCollapsed !== undefined) return;
    if (calendarSidebarsCollapsedByDefault(layoutMode)) {
      setCollapsedUncontrolled(true);
    }
  }, [collapsedProp, defaultCollapsed, layoutMode]);

  const setCollapsed = (v: boolean) => {
    if (collapsedProp === undefined) setCollapsedUncontrolled(v);
    onCollapsedChange?.(v);
  };

  const stats = useMemo(
    () => computeCalendarDailyStats(bookings, dayKey, calendarTimezone),
    [bookings, dayKey, calendarTimezone]
  );

  const quickMatches = useMemo(() => {
    const q = localQ.trim().toLowerCase();
    if (q.length < 2) return [];
    return bookings
      .filter((b) => {
        const label = bookingDisplay[b.id]?.anchorLabel ?? b.title ?? "";
        return (
          label.toLowerCase().includes(q) ||
          b.booking_type.toLowerCase().includes(q) ||
          b.booking_status.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [bookings, bookingDisplay, localQ]);

  function openGlobalSearch() {
    window.dispatchEvent(new Event(CLINIC_OS_OPEN_GLOBAL_SEARCH_EVENT));
  }

  if (layoutMode === "compact" && !forceOsDrawer) {
    return null;
  }

  if (collapsed) {
    return (
      <aside
        className={cn(
          "flex w-12 shrink-0 flex-col items-center gap-3 border-l border-slate-200/80 bg-white py-4",
          className
        )}
        aria-label="Calendar insights panel"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Expand insights panel"
        >
          <PanelRightOpen className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("search");
            setCollapsed(false);
          }}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Patient search"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("stats");
            setCollapsed(false);
          }}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Daily stats"
        >
          <BarChart3 className="h-5 w-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={cn("flex w-[17rem] shrink-0 flex-col border-l border-slate-200/80 bg-white", className)}
      aria-label="Calendar insights panel"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-3">
        <div className="inline-flex rounded-lg border border-slate-200/90 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setTab("search")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition",
              tab === "search" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setTab("stats")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition",
              tab === "stats" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            Stats
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Collapse insights panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === "search" ? (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearchSubmit(localQ.trim());
              }}
            >
              <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Quick patient search
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  type="search"
                  value={localQ}
                  onChange={(e) => setLocalQ(e.target.value)}
                  placeholder="Name, procedure, status…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-400/20"
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Filter calendar
              </button>
            </form>

            <button
              type="button"
              onClick={openGlobalSearch}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Open workspace search (⌘K)
            </button>

            {quickMatches.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Matches</p>
                <ul className="space-y-1.5">
                  {quickMatches.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-2.5 py-2 text-xs text-slate-700"
                    >
                      <p className="truncate font-semibold text-slate-900">
                        {bookingDisplay[b.id]?.anchorLabel ?? b.title ?? "Booking"}
                      </p>
                      <p className="mt-0.5 truncate text-slate-500">
                        {b.booking_type} · {b.booking_status}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Today</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">appointments scheduled</p>
            </div>

            <dl className="grid grid-cols-2 gap-2">
              {[
                { label: "Confirmed", value: stats.confirmed },
                { label: "Arrived", value: stats.arrived },
                { label: "Consults", value: stats.consultations },
                { label: "Hair Transplant", value: stats.surgery },
                { label: "PRP", value: stats.prp },
                { label: "Waitlist", value: stats.waitlist },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2.5"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/70 px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          Collapse
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
