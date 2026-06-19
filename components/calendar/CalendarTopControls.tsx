"use client";

import { useRouter } from "next/navigation";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Keyboard, MapPin, Moon, PanelLeftOpen, Sun, Users } from "lucide-react";

import {
  mergeCalendarHrefQuery,
  type CalendarRoute,
  type CalendarViewMode,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import { buildCalendarNavigationHref } from "@/src/lib/calendar/calendarViewNavigation";
import { calendarNavigationHelpers } from "@/src/lib/bookings/calendarView";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { staffOptionPrimaryLabel } from "@/src/lib/staff/staffAssigneeDisplay";
import { CalendarToolbarFilterSelect } from "@/components/calendar/CalendarToolbarFilterSelect";
import { CalendarTransitionLink } from "@/components/calendar/CalendarTransitionLink";
import { measureCalendarSync } from "@/lib/calendar/calendarInteractionPerfDev";
import { pushCalendarHref } from "@/lib/calendar/calendarRouterTransition";
import { cn } from "@/lib/utils";
import { useFiCalendarWorkspaceDisplayTheme } from "@/src/components/fi-admin/calendar/fiCalendarWorkspaceDisplayTheme";
import {
  calendarClinicFilterSelectValue,
  calendarStaffFilterSelectValue,
} from "@/src/lib/calendar/calendarToolbarFilters";

const VIEW_OPTIONS: { id: CalendarViewMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "3day", label: "3 Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

/** FI OS scheduling workspace — Day / Week / Month only (legacy `3day` URLs highlight Week). */
const VIEW_OPTIONS_FI_OS: { id: CalendarViewMode; label: string; active: (q: ParsedCalendarQuery) => boolean }[] = [
  { id: "day", label: "Day", active: (q) => q.view === "day" },
  { id: "week", label: "Week", active: (q) => q.view === "week" || q.view === "3day" },
  { id: "month", label: "Month", active: (q) => q.view === "month" },
];

export function CalendarTopControls({
  tenantId,
  query,
  rangeTitle,
  staffDirectory,
  clinics,
  canMutateBookings,
  bookingMutationBlockedReason = null,
  route = "fi-admin",
  variant = "default",
  fiOsPanelControls,
}: {
  tenantId: string;
  query: ParsedCalendarQuery;
  rangeTitle: string;
  /** Active staff (`fi_staff.id`) for the staff URL filter — not the same as booking user assignees. */
  staffDirectory: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  canMutateBookings: boolean;
  /** Shown when {@link canMutateBookings} is false — sign-in, membership, or role. */
  bookingMutationBlockedReason?: string | null;
  route?: CalendarRoute;
  variant?: "default" | "fiOs";
  fiOsPanelControls?: {
    agendaOpen: boolean;
    insightsOpen: boolean;
    onToggleAgenda: () => void;
    onToggleInsights: () => void;
  };
}) {
  const router = useRouter();
  const fiCalTheme = useFiCalendarWorkspaceDisplayTheme();
  const hrefOpts = { route };
  const prev = buildCalendarNavigationHref(tenantId, query, calendarNavigationHelpers.previousPeriod(query), hrefOpts);
  const next = buildCalendarNavigationHref(tenantId, query, calendarNavigationHelpers.nextPeriod(query), hrefOpts);
  const today = buildCalendarNavigationHref(
    tenantId,
    query,
    calendarNavigationHelpers.goToToday(),
    hrefOpts
  );

  function navigate(patch: Parameters<typeof mergeCalendarHrefQuery>[1]) {
    const href = measureCalendarSync("calendar.toolbar.buildHref", () =>
      buildCalendarNavigationHref(tenantId, query, patch, hrefOpts)
    );
    pushCalendarHref(router, href);
  }

  const isFiOs = variant === "fiOs";
  const displayTheme = fiCalTheme?.theme ?? "dark";
  const filterShell = isFiOs
    ? "border-[color:var(--fi-cal-ws-controls-inset-border,rgba(255,255,255,0.08))] bg-[var(--fi-cal-ws-controls-inset-bg,rgb(6_13_24/0.9))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "border-[#1e2937] bg-[#0b1220] shadow-sm shadow-black/20";
  const shell = isFiOs
    ? "border-b border-[color:var(--fi-cal-ws-strip-border,rgba(255,255,255,0.08))] bg-[var(--fi-cal-ws-strip-bg,rgb(6_13_24/0.9))] px-3 py-3 backdrop-blur-xl sm:px-4"
    : "border-b border-[#1e2937] bg-[#0f172a] px-4 py-3";
  const inset = isFiOs
    ? "rounded-xl border border-[color:var(--fi-cal-ws-controls-inset-border,rgba(255,255,255,0.08))] bg-[var(--fi-cal-ws-controls-inset-bg,rgb(6_13_24/0.9))] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "rounded-xl border border-[#1e2937] bg-[#0b1220] p-0.5 shadow-sm shadow-black/20";
  const navBtn = isFiOs
    ? "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-cyan-100"
    : "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-100";
  const todayCls = isFiOs
    ? "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
    : "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white";
  const dateShell = isFiOs
    ? "relative inline-flex items-center gap-2 rounded-xl border border-[color:var(--fi-cal-ws-controls-inset-border,rgba(255,255,255,0.08))] bg-[var(--fi-cal-ws-controls-inset-bg,rgb(6_13_24/0.9))] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "relative inline-flex items-center gap-2 rounded-xl border border-[#1e2937] bg-[#0b1220] px-3 py-1.5 shadow-sm shadow-black/20";
  const rangeCls = isFiOs ? "hidden text-sm font-medium text-[var(--fi-cal-ws-text,#f1f5f9)] lg:block" : "hidden text-sm font-medium text-slate-300 lg:block";
  const viewOpts = isFiOs ? VIEW_OPTIONS_FI_OS : VIEW_OPTIONS.map((o) => ({ ...o, active: (q: ParsedCalendarQuery) => q.view === o.id }));

  return (
    <>
      <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", shell)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {isFiOs && fiOsPanelControls ? (
          <div
            className={cn("inline-flex items-center gap-0.5 rounded-xl border p-0.5", filterShell)}
            role="group"
            aria-label="Calendar drawers"
          >
            <button
              type="button"
              onClick={fiOsPanelControls.onToggleAgenda}
              aria-pressed={fiOsPanelControls.agendaOpen}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
                fiOsPanelControls.agendaOpen
                  ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
              )}
              title="Agenda & waitlist"
              aria-label="Toggle agenda and waitlist drawer"
            >
              <PanelLeftOpen className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={fiOsPanelControls.onToggleInsights}
              aria-pressed={fiOsPanelControls.insightsOpen}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
                fiOsPanelControls.insightsOpen
                  ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
              )}
              title="Daily insights"
              aria-label="Toggle daily insights drawer"
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        <div className={inset}>
          <CalendarTransitionLink href={prev} className={navBtn} aria-label="Previous period">
            <ChevronLeft className="h-4 w-4" />
          </CalendarTransitionLink>
          <CalendarTransitionLink href={today} className={todayCls}>
            Today
          </CalendarTransitionLink>
          <CalendarTransitionLink href={next} className={navBtn} aria-label="Next period">
            <ChevronRight className="h-4 w-4" />
          </CalendarTransitionLink>
        </div>

        <label className={dateShell}>
          <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden />
          <input
            type="date"
            value={query.dateAnchor}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v) navigate({ date: v });
            }}
            className="border-0 bg-transparent p-0 text-sm font-medium text-[var(--fi-cal-ws-text,#f1f5f9)] outline-none focus:ring-0 [color-scheme:var(--fi-cal-ws-date-scheme,dark)]"
            aria-label="Calendar date"
          />
        </label>

        <p className={rangeCls}>{rangeTitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className={cn(inset, "inline-flex")} role="group" aria-label="Calendar view">
          {viewOpts.map((opt) => {
            const href = buildCalendarNavigationHref(tenantId, query, { view: opt.id }, hrefOpts);
            const active = opt.active(query);
            return (
              <CalendarTransitionLink
                key={opt.id}
                href={href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm",
                  active
                    ? isFiOs
                      ? "bg-cyan-500/90 text-[#041018] shadow-[0_0_16px_rgba(34,211,238,0.25)]"
                      : "bg-sky-500 text-white shadow-md shadow-sky-500/25"
                    : isFiOs
                      ? "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                )}
                aria-current={active ? "page" : undefined}
              >
                {opt.label}
              </CalendarTransitionLink>
            );
          })}
        </div>

        <CalendarToolbarFilterSelect
          variant={isFiOs ? "fiOs" : "default"}
          displayTheme={displayTheme}
          ariaLabel="Staff filter"
          placeholder="All staff"
          icon={Users}
          value={calendarStaffFilterSelectValue(query.staffId)}
          options={staffDirectory.map((a) => ({
            value: a.id,
            label: staffOptionPrimaryLabel(a),
          }))}
          onValueChange={(staffId) =>
            navigate({
              staffId: staffId ? staffId : null,
              /** Clear legacy assignee param so server normalization cannot override toolbar selection. */
              assignedUserId: null,
            })
          }
        />

        <CalendarToolbarFilterSelect
          variant={isFiOs ? "fiOs" : "default"}
          displayTheme={displayTheme}
          ariaLabel="Location filter"
          placeholder="All locations"
          icon={MapPin}
          maxWidthClass="max-w-[9rem] sm:max-w-[12rem]"
          value={calendarClinicFilterSelectValue(query.clinicId)}
          options={
            clinics.length === 0
              ? [{ value: "south-perth", label: "South Perth" }]
              : clinics.map((c) => ({ value: c.id, label: c.display_name }))
          }
          onValueChange={(clinicId) => navigate({ clinicId: clinicId ? clinicId : null })}
        />

        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
            canMutateBookings
              ? isFiOs
                ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/25"
                : "bg-emerald-950/60 text-emerald-300 ring-1 ring-emerald-500/30"
              : isFiOs
                ? "bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.08]"
                : "bg-slate-800 text-slate-400 ring-1 ring-slate-600/40"
          )}
          title={
            canMutateBookings
              ? "You can create and move appointments."
              : bookingMutationBlockedReason?.trim() || "Calendar is read-only."
          }
        >
          {canMutateBookings ? "Live" : "Read-only"}
        </span>

        {isFiOs && fiCalTheme ? (
          <div className={cn("inline-flex items-center gap-0.5 rounded-xl border p-0.5", filterShell)}
            role="group"
            aria-label="Calendar display theme"
          >
            <button
              type="button"
              onClick={() => fiCalTheme.setTheme("dark")}
              aria-pressed={fiCalTheme.theme === "dark"}
              title="Dark calendar"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
                fiCalTheme.theme === "dark"
                  ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
              )}
            >
              <Moon className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => fiCalTheme.setTheme("light")}
              aria-pressed={fiCalTheme.theme === "light"}
              title="Light calendar"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
                fiCalTheme.theme === "light"
                  ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
              )}
            >
              <Sun className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("fi-calendar-toggle-shortcuts"))}
          className={cn(
            "hidden items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition sm:inline-flex",
            isFiOs
              ? cn("border text-slate-400 hover:border-cyan-500/20 hover:text-cyan-100", filterShell)
              : "border border-[#1e2937] bg-[#0b1220] text-slate-400 shadow-sm shadow-black/20 hover:border-slate-600 hover:text-slate-100"
          )}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden md:inline">Shortcuts</span>
          <kbd
            className={cn(
              "rounded border px-1 font-mono text-[10px]",
              isFiOs ? "border-white/[0.1] bg-black/30 text-slate-400" : "border-[#1e2937] bg-slate-900 text-slate-400"
            )}
          >
            ?
          </kbd>
        </button>
      </div>

      <p className={cn("text-sm font-medium lg:hidden", isFiOs ? "text-slate-200" : "text-slate-300")}>{rangeTitle}</p>
      </div>
      {!canMutateBookings && bookingMutationBlockedReason?.trim() ? (
        <div
          className={cn(
            "border-b px-4 py-2 text-xs font-medium leading-snug",
            isFiOs
              ? "border-amber-500/35 bg-amber-950/35 text-amber-100"
              : "border-amber-500/30 bg-amber-950/40 text-amber-100"
          )}
          role="status"
        >
          {bookingMutationBlockedReason.trim()}
        </div>
      ) : null}
    </>
  );
}
