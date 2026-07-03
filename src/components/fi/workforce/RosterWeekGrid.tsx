"use client";

import type { RosterGridAvailabilityCell, RosterGridShift } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  formatStandardHoursSummary,
  formatStandardHoursWeeklyTotal,
  staffHasConfiguredStandardHours,
  type StaffStandardHoursDayInput,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  blockTypeDisplayLabel,
  shiftSourceDisplayLabel,
} from "@/src/lib/workforce-os/rosterGenerationCore";
import { ROSTER_GRID_SCROLL_CLASSES } from "@/src/lib/workforce-os/rosterCommandCentreUxCore";
import { cn } from "@/lib/utils";

export type RosterWeekGridProps = {
  weekDayDates: string[];
  staffOptions: Array<{ id: string; name: string; role: string | null }>;
  shifts: RosterGridShift[];
  availabilityCells: RosterGridAvailabilityCell[];
  standardHoursByStaffId: Record<string, StaffStandardHoursDayInput[]>;
  onCellClick?: (staffId: string, localDate: string) => void;
  onShiftClick?: (shift: RosterGridShift) => void;
  onEditStandardHours?: (staffId: string) => void;
  selectedShiftId?: string | null;
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
  return shifts.filter(
    (s) => s.staff_id === staffId && s.starts_at.slice(0, 10) === localDate.slice(0, 10)
  );
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
  localDate: string
): boolean {
  if (!standardHours?.length) return false;
  const d = new Date(`${localDate.slice(0, 10)}T12:00:00.000Z`);
  const day = d.getUTCDay();
  const weekday = day === 0 ? 6 : day - 1;
  const row = standardHours.find((h) => h.weekday === weekday);
  return Boolean(row && !row.is_working_day);
}

export function RosterWeekGrid({
  weekDayDates,
  staffOptions,
  shifts,
  availabilityCells,
  standardHoursByStaffId,
  onCellClick,
  onShiftClick,
  onEditStandardHours,
  selectedShiftId,
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
            const weeklyTotal = formatStandardHoursWeeklyTotal(standardHours);

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
                  <p className="mt-0.5 text-xs text-slate-500">
                    Weekly total: {weeklyTotal} h
                  </p>
                  {onEditStandardHours ? (
                    <button
                      type="button"
                      onClick={() => onEditStandardHours(staff.id)}
                      data-testid={`standard-hours-button-${staff.id}`}
                      className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-cyan-500/35 bg-cyan-950/30 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-950/50"
                    >
                      {hasStandardHours ? "Edit standard hours" : "Set standard hours"}
                    </button>
                  ) : null}
                </td>
                {weekDayDates.map((date) => {
                  const cellShifts = shiftsForCell(shifts, staff.id, date);
                  const cellBlocks = availabilityForCell(availabilityCells, staff.id, date);
                  const rdo =
                    cellShifts.length === 0 &&
                    cellBlocks.length === 0 &&
                    isRdoDay(standardHours, date);
                  const emptyCell = cellShifts.length === 0 && cellBlocks.length === 0 && !rdo;

                  return (
                    <td
                      key={`${staff.id}-${date}`}
                      className="min-h-[88px] border-l border-white/[0.04] px-1.5 py-2"
                    >
                      <button
                        type="button"
                        data-testid={`roster-cell-${staff.id}-${date}`}
                        className="flex min-h-[80px] w-full flex-col gap-1 rounded-lg border border-transparent p-1.5 text-left hover:border-white/[0.08] hover:bg-white/[0.02]"
                        onClick={() => onCellClick?.(staff.id, date)}
                      >
                        {cellShifts.map((shift) => (
                          <span
                            key={shift.id}
                            role="presentation"
                            onClick={(e) => {
                              e.stopPropagation();
                              onShiftClick?.(shift);
                            }}
                            className={cn(
                              "block rounded-md px-2 py-1.5",
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
                          <span className="block rounded-md bg-white/[0.03] px-2 py-1.5 text-xs text-slate-500">
                            RDO
                          </span>
                        ) : null}
                        {emptyCell && !hasStandardHours ? (
                          <span
                            className="block px-1 py-2 text-xs font-medium text-amber-300/90"
                            data-testid={`set-standard-hours-first-${staff.id}-${date}`}
                          >
                            Set standard hours first
                          </span>
                        ) : null}
                        {emptyCell && hasStandardHours ? (
                          <span className="block px-1 py-2 text-xs text-cyan-300/80">
                            Generate or add shift
                          </span>
                        ) : null}
                      </button>
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
