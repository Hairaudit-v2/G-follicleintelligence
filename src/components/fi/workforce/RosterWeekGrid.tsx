"use client";

import Link from "next/link";

import type {
  RosterGridAvailabilityCell,
  RosterGridShift,
} from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  buildStaffStandardHoursEditorHref,
  buildStaffStandardHoursReturnToRosterHref,
  ROSTER_MANAGE_DENIED_REASON,
} from "@/src/lib/workforce-os/staffStandardHoursRoutes";
import {
  formatStandardHoursSummary,
  formatStandardHoursWeeklyTotal,
  normaliseCycleWeek,
  staffHasConfiguredStandardHours,
  type StaffStandardHoursDayInput,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  blockTypeDisplayLabel,
  shiftSourceDisplayLabel,
} from "@/src/lib/workforce-os/rosterGenerationCore";
import type { RosterCadence } from "@/src/lib/workforce/rosterCadencePolicyCore";
import { resolveFortnightCycleWeek } from "@/src/lib/workforce/rosterCadencePolicyCore";
import {
  ROSTER_GRID_SCROLL_CLASSES,
  type RosterDayAwayKind,
  shiftMatchesRosterCellDate,
} from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import { cn } from "@/lib/utils";

export type RosterWeekGridProps = {
  tenantId: string;
  weekDayDates: string[];
  staffOptions: Array<{ id: string; name: string; role: string | null }>;
  shifts: RosterGridShift[];
  availabilityCells: RosterGridAvailabilityCell[];
  standardHoursByStaffId: Record<string, StaffStandardHoursDayInput[]>;
  rosterCadence?: RosterCadence;
  rosterCycleAnchorDate?: string;
  canManage?: boolean;
  manageDeniedReason?: string;
  showStandardHoursEditor?: boolean;
  /** e.g. "week" / "fortnight" for mark-away CTA labels */
  periodLabel?: string;
  onCellClick?: (staffId: string, localDate: string) => void;
  onShiftClick?: (shift: RosterGridShift) => void;
  /** One-click cancel from the shift chip (does not open the edit drawer). */
  onQuickCancelShift?: (shift: RosterGridShift) => void;
  /** Mark staff away for every day in the displayed period. */
  onMarkPeriodAway?: (staffId: string, kind: RosterDayAwayKind) => void;
  onEditStandardHours?: (staffId: string) => void;
  selectedShiftId?: string | null;
  /** Shift currently being cancelled (disables chip controls). */
  quickCancelPendingShiftId?: string | null;
  periodAwayPendingStaffId?: string | null;
};

function formatDayHeader(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function formatShiftTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function shiftsForCell(
  shifts: RosterGridShift[],
  staffId: string,
  localDate: string
): RosterGridShift[] {
  return shifts.filter((s) => shiftMatchesRosterCellDate(s, staffId, localDate));
}

function availabilityForCell(
  cells: RosterGridAvailabilityCell[],
  staffId: string,
  localDate: string
): RosterGridAvailabilityCell[] {
  return cells.filter(
    (c) => c.staffId === staffId && c.localDate.slice(0, 10) === localDate.slice(0, 10)
  );
}

function isRdoDay(
  standardHours: StaffStandardHoursDayInput[] | undefined,
  localDate: string,
  cadence: RosterCadence = "weekly",
  anchorDate = "2026-01-05"
): boolean {
  if (!standardHours?.length) return false;
  const d = new Date(`${localDate.slice(0, 10)}T12:00:00.000Z`);
  const day = d.getUTCDay();
  const weekday = day === 0 ? 6 : day - 1;
  const cycleWeek =
    cadence === "fortnightly" ? resolveFortnightCycleWeek(localDate, anchorDate) : 1;
  const row =
    standardHours.find(
      (h) => h.weekday === weekday && normaliseCycleWeek(h.cycle_week) === cycleWeek
    ) ?? standardHours.find((h) => h.weekday === weekday && normaliseCycleWeek(h.cycle_week) === 1);
  return Boolean(row && !row.is_working_day);
}

function shiftIsCancellable(shift: RosterGridShift): boolean {
  return shift.status === "scheduled" || shift.status === "confirmed";
}

export function RosterWeekGrid({
  tenantId,
  weekDayDates,
  staffOptions,
  shifts,
  availabilityCells,
  standardHoursByStaffId,
  rosterCadence = "weekly",
  rosterCycleAnchorDate = "2026-01-05",
  canManage = true,
  manageDeniedReason = ROSTER_MANAGE_DENIED_REASON,
  showStandardHoursEditor = true,
  periodLabel = "period",
  onCellClick,
  onShiftClick,
  onQuickCancelShift,
  onMarkPeriodAway,
  onEditStandardHours,
  selectedShiftId,
  quickCancelPendingShiftId = null,
  periodAwayPendingStaffId = null,
}: RosterWeekGridProps) {
  if (staffOptions.length === 0) {
    return <p className="text-sm text-slate-500">No staff match the current filters.</p>;
  }

  return (
    <div
      className={cn(
        ROSTER_GRID_SCROLL_CLASSES,
        "rounded-xl border border-white/[0.08] bg-[#0F1629]/40"
      )}
      data-testid="roster-week-grid"
    >
      <table className="min-w-[960px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.02]">
            <th className="sticky left-0 z-10 min-w-[220px] bg-[#0F1629] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Staff
            </th>
            {weekDayDates.map((date) => (
              <th
                key={date}
                className="min-w-[120px] px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              >
                {formatDayHeader(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staffOptions.map((staff) => {
            const standardHours = standardHoursByStaffId[staff.id];
            const hasStandardHours = staffHasConfiguredStandardHours(standardHours);
            const summary = formatStandardHoursSummary(standardHours);
            const weeklyTotal = formatStandardHoursWeeklyTotal(standardHours ?? []);
            const periodAwayPending = periodAwayPendingStaffId === staff.id;

            return (
              <tr key={staff.id} className="border-b border-white/[0.05] align-top">
                <td className="sticky left-0 z-10 bg-[#0F1629] px-3 py-3">
                  <p className="font-medium text-slate-100">{staff.name}</p>
                  {staff.role ? (
                    <p className="text-xs capitalize text-slate-500">{staff.role}</p>
                  ) : null}
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      hasStandardHours ? "text-slate-400" : "text-amber-300/90"
                    )}
                    data-testid={`standard-hours-summary-${staff.id}`}
                  >
                    {summary}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">Weekly total: {weeklyTotal} h</p>
                  {showStandardHoursEditor ? (
                    canManage ? (
                      <Link
                        href={buildStaffStandardHoursEditorHref(tenantId, staff.id, {
                          returnTo: buildStaffStandardHoursReturnToRosterHref(tenantId),
                        })}
                        onClick={() => onEditStandardHours?.(staff.id)}
                        data-testid={`standard-hours-button-${staff.id}`}
                        className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-white/[0.12] px-3 py-1.5 text-xs text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                      >
                        {hasStandardHours ? "Edit template hours" : "Set template hours"}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEditStandardHours?.(staff.id)}
                        className="mt-2 inline-flex min-h-9 cursor-not-allowed items-center rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-500"
                        title={manageDeniedReason}
                        data-testid={`standard-hours-button-disabled-${staff.id}`}
                      >
                        Set template hours
                      </button>
                    )
                  ) : null}

                  {canManage && onMarkPeriodAway ? (
                    <div className="mt-2 space-y-1" data-testid={`mark-period-away-${staff.id}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Mark {periodLabel} away
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={periodAwayPending}
                          data-testid={`mark-period-sick-${staff.id}`}
                          onClick={() => onMarkPeriodAway(staff.id, "sick_leave")}
                          className="rounded-md border border-rose-500/35 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-950/50 disabled:opacity-50"
                        >
                          Sick
                        </button>
                        <button
                          type="button"
                          disabled={periodAwayPending}
                          data-testid={`mark-period-personal-${staff.id}`}
                          onClick={() => onMarkPeriodAway(staff.id, "leave")}
                          className="rounded-md border border-amber-500/35 bg-amber-950/25 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-950/45 disabled:opacity-50"
                        >
                          Personal
                        </button>
                        <button
                          type="button"
                          disabled={periodAwayPending}
                          data-testid={`mark-period-unavailable-${staff.id}`}
                          onClick={() => onMarkPeriodAway(staff.id, "unavailable")}
                          className="rounded-md border border-white/[0.12] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"
                        >
                          Away
                        </button>
                      </div>
                    </div>
                  ) : null}
                </td>
                {weekDayDates.map((date) => {
                  const cellShifts = shiftsForCell(shifts, staff.id, date);
                  const cellBlocks = availabilityForCell(availabilityCells, staff.id, date);
                  const rdo =
                    cellShifts.length === 0 &&
                    cellBlocks.length === 0 &&
                    isRdoDay(standardHours, date, rosterCadence, rosterCycleAnchorDate);
                  const emptyCell = cellShifts.length === 0 && cellBlocks.length === 0 && !rdo;

                  return (
                    <td
                      key={`${staff.id}-${date}`}
                      className="min-h-[88px] border-l border-white/[0.04] px-1.5 py-2"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        data-testid={`roster-cell-${staff.id}-${date}`}
                        title={!canManage ? manageDeniedReason : undefined}
                        className={cn(
                          "flex min-h-[80px] w-full cursor-pointer flex-col gap-1 rounded-lg border border-transparent p-1.5 text-left",
                          canManage
                            ? "hover:border-white/[0.08] hover:bg-white/[0.02]"
                            : "cursor-not-allowed opacity-70"
                        )}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          onCellClick?.(staff.id, date);
                        }}
                        onClick={(event) => {
                          const quickCancel = (event.target as HTMLElement).closest(
                            "[data-roster-quick-cancel]"
                          );
                          if (quickCancel) {
                            event.stopPropagation();
                            const shiftId = quickCancel.getAttribute("data-roster-quick-cancel");
                            const shift = cellShifts.find((row) => row.id === shiftId);
                            if (shift) onQuickCancelShift?.(shift);
                            return;
                          }
                          const shiftTarget = (event.target as HTMLElement).closest(
                            "[data-roster-shift-id]"
                          );
                          if (shiftTarget) {
                            const shiftId = shiftTarget.getAttribute("data-roster-shift-id");
                            const shift = cellShifts.find((row) => row.id === shiftId);
                            if (shift) {
                              event.stopPropagation();
                              onShiftClick?.(shift);
                              return;
                            }
                          }
                          onCellClick?.(staff.id, date);
                        }}
                      >
                        {cellShifts.map((shift) => (
                          <span
                            key={shift.id}
                            data-roster-shift-id={shift.id}
                            data-testid={`roster-shift-${shift.id}`}
                            className={cn(
                              "relative block rounded-md px-2 py-1.5 pr-7",
                              selectedShiftId === shift.id ? "ring-1 ring-cyan-400/60" : "",
                              shift.shift_source === "standard_hours"
                                ? "bg-cyan-950/50 text-cyan-100"
                                : shift.shift_source === "copy_week"
                                  ? "bg-violet-950/40 text-violet-100"
                                  : "bg-emerald-950/40 text-emerald-100"
                            )}
                          >
                            <span className="block text-xs font-medium capitalize">
                              {shift.shift_type.replace(/_/g, " ")}
                            </span>
                            <span className="block text-xs opacity-80">
                              {formatShiftTime(shift.starts_at)}–{formatShiftTime(shift.ends_at)}
                            </span>
                            <span className="block text-[10px] opacity-60">
                              {shiftSourceDisplayLabel(shift.shift_source)}
                            </span>
                            {canManage && onQuickCancelShift && shiftIsCancellable(shift) ? (
                              <button
                                type="button"
                                data-roster-quick-cancel={shift.id}
                                data-testid={`roster-quick-cancel-${shift.id}`}
                                disabled={quickCancelPendingShiftId === shift.id}
                                title="Cancel this shift"
                                aria-label={`Cancel shift ${shift.shift_type.replace(/_/g, " ")}`}
                                className="absolute right-1 top-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-950/60 hover:text-rose-50 disabled:opacity-40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onQuickCancelShift(shift);
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))}
                        {cellBlocks.map((block) => (
                          <span
                            key={block.blockId}
                            className="block rounded-md bg-rose-950/40 px-2 py-1.5 text-xs text-rose-200"
                          >
                            {blockTypeDisplayLabel(
                              block.blockType as import("@/src/lib/workforce-os/workforceRosteringEngine").AvailabilityBlockType
                            )}
                          </span>
                        ))}
                        {rdo ? (
                          <span
                            className="block rounded-md bg-white/[0.03] px-2 py-1.5 text-xs text-slate-500"
                            data-testid={`rdo-cell-${staff.id}-${date}`}
                          >
                            RDO · click to add shift or mark away
                          </span>
                        ) : null}
                        {emptyCell ? (
                          <span
                            className="block px-1 py-2 text-xs font-medium text-cyan-300/90"
                            data-testid={`add-shift-${staff.id}-${date}`}
                          >
                            + Add shift / mark away
                          </span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
