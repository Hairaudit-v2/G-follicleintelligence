"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Keyboard, MapPin, Users } from "lucide-react";

import {
  buildCalendarHref,
  mergeCalendarHrefQuery,
  type CalendarRoute,
  type CalendarViewMode,
  type ParsedCalendarQuery,
} from "@/src/lib/bookings/calendarQuery";
import { calendarNavigationHelpers } from "@/src/lib/bookings/calendarView";
import type { CrmShellClinicOption, CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS: { id: CalendarViewMode; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "3day", label: "3 Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export function CalendarTopControls({
  tenantId,
  query,
  rangeTitle,
  assignees,
  clinics,
  canMutateBookings,
  route = "fi-admin",
}: {
  tenantId: string;
  query: ParsedCalendarQuery;
  rangeTitle: string;
  assignees: CrmShellUserPickerOption[];
  clinics: CrmShellClinicOption[];
  canMutateBookings: boolean;
  route?: CalendarRoute;
}) {
  const router = useRouter();
  const hrefOpts = { route };
  const prev = buildCalendarHref(tenantId, calendarNavigationHelpers.previousPeriod(query), hrefOpts);
  const next = buildCalendarHref(tenantId, calendarNavigationHelpers.nextPeriod(query), hrefOpts);
  const today = buildCalendarHref(
    tenantId,
    mergeCalendarHrefQuery(query, calendarNavigationHelpers.goToToday()),
    hrefOpts
  );

  function navigate(patch: Parameters<typeof mergeCalendarHrefQuery>[1]) {
    router.push(buildCalendarHref(tenantId, mergeCalendarHrefQuery(query, patch), hrefOpts));
  }

  const selectedClinic =
    clinics.find((c) => c.id === query.clinicId) ??
    clinics.find((c) => /south perth/i.test(c.display_name)) ??
    clinics[0];

  return (
    <div className="flex flex-col gap-3 border-b border-[#1e2937] bg-[#0f172a] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-xl border border-[#1e2937] bg-[#0b1220] p-0.5 shadow-sm shadow-black/20">
          <Link
            href={prev}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={today}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            Today
          </Link>
          <Link
            href={next}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <label className="relative inline-flex items-center gap-2 rounded-xl border border-[#1e2937] bg-[#0b1220] px-3 py-1.5 shadow-sm shadow-black/20">
          <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden />
          <input
            type="date"
            value={query.dateAnchor}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v) navigate({ date: v });
            }}
            className="border-0 bg-transparent p-0 text-sm font-medium text-slate-100 outline-none focus:ring-0 [color-scheme:dark]"
            aria-label="Calendar date"
          />
        </label>

        <p className="hidden text-sm font-medium text-slate-300 lg:block">{rangeTitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-xl border border-[#1e2937] bg-[#0b1220] p-0.5 shadow-sm shadow-black/20"
          role="group"
          aria-label="Calendar view"
        >
          {VIEW_OPTIONS.map((opt) => {
            const href = buildCalendarHref(tenantId, mergeCalendarHrefQuery(query, { view: opt.id }), hrefOpts);
            const active = query.view === opt.id;
            return (
              <Link
                key={opt.id}
                href={href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm",
                  active
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/25"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                )}
                aria-current={active ? "page" : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>

        <label className="inline-flex items-center gap-2 rounded-xl border border-[#1e2937] bg-[#0b1220] px-2.5 py-1.5 shadow-sm shadow-black/20">
          <Users className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span className="sr-only">Staff filter</span>
          <select
            value={query.assignedUserId ?? ""}
            onChange={(e) => navigate({ assignedUserId: e.target.value || undefined })}
            className="max-w-[9rem] border-0 bg-transparent py-0.5 text-sm font-medium text-slate-200 outline-none sm:max-w-[11rem] [color-scheme:dark]"
          >
            <option value="">All staff</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email?.trim() || a.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex items-center gap-2 rounded-xl border border-[#1e2937] bg-[#0b1220] px-2.5 py-1.5 shadow-sm shadow-black/20">
          <MapPin className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span className="sr-only">Location</span>
          <select
            value={query.clinicId ?? selectedClinic?.id ?? ""}
            onChange={(e) => navigate({ clinicId: e.target.value || undefined })}
            className="max-w-[9rem] border-0 bg-transparent py-0.5 text-sm font-medium text-slate-200 outline-none sm:max-w-[12rem] [color-scheme:dark]"
          >
            <option value="">All locations</option>
            {clinics.length === 0 ? (
              <option value="south-perth">South Perth</option>
            ) : (
              clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))
            )}
          </select>
        </label>

        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
            canMutateBookings
              ? "bg-emerald-950/60 text-emerald-300 ring-1 ring-emerald-500/30"
              : "bg-slate-800 text-slate-400 ring-1 ring-slate-600/40"
          )}
        >
          {canMutateBookings ? "Live" : "Read-only"}
        </span>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("fi-calendar-toggle-shortcuts"))}
          className="hidden items-center gap-1.5 rounded-xl border border-[#1e2937] bg-[#0b1220] px-2.5 py-1.5 text-xs font-medium text-slate-400 shadow-sm shadow-black/20 transition hover:border-slate-600 hover:text-slate-100 sm:inline-flex"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden md:inline">Shortcuts</span>
          <kbd className="rounded border border-[#1e2937] bg-slate-900 px-1 font-mono text-[10px] text-slate-400">?</kbd>
        </button>
      </div>

      <p className="text-sm font-medium text-slate-300 lg:hidden">{rangeTitle}</p>
    </div>
  );
}
