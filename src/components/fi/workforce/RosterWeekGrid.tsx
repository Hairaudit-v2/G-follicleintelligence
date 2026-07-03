"use client";

import type { RosterGridAvailabilityCell, RosterGridShift } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import type { StaffStandardHoursDayInput } from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  blockTypeDisplayLabel,
  shiftSourceDisplayLabel,
} from "@/src/lib/workforce-os/rosterGenerationCore";

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
    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0F1629]/40">
      <table className="min-w-[960px] w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.02]">
            <th className="sticky left-0 z-10 min-w-[140px] bg-[#0F1629] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Staff
            </th>
            {weekDayDates.map((date) => (
              <th
                key={date}
                className="min-w-[110px] px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500"
              >
                {formatDayHeader(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staffOptions.map((staff) => {
            const standardHours = standardHoursByStaffId[staff.id];
            return (
              <tr key={staff.id} className="border-b border-white/[0.05] align-top">
                <td className="sticky left-0 z-10 bg-[#0F1629] px-3 py-2">
                  <p className="font-medium text-slate-100">{staff.name}</p>
                  {staff.role ? (
                    <p className="text-[10px] capitalize text-slate-500">{staff.role}</p>
                  ) : null}
                  {onEditStandardHours ? (
                    <button
                      type="button"
                      onClick={() => onEditStandardHours(staff.id)}
                      className="mt-1 text-[10px] text-cyan-400 hover:text-cyan-300"
                    >
                      Standard hours
                    </button>
                  ) : null}
                </td>
                {weekDayDates.map((date) => {
                  const cellShifts = shiftsForCell(shifts, staff.id, date);
                  const cellBlocks = availabilityForCell(availabilityCells, staff.id, date);
                  const rdo = cellShifts.length === 0 && cellBlocks.length === 0 && isRdoDay(standardHours, date);

                  return (
                    <td
                      key={`${staff.id}-${date}`}
                      className="min-h-[72px] border-l border-white/[0.04] px-1.5 py-1.5"
                    >
                      <button
                        type="button"
                        className="flex min-h-[64px] w-full flex-col gap-1 rounded-lg border border-transparent p-1 text-left hover:border-white/[0.08] hover:bg-white/[0.02]"
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
                            className={`block rounded-md px-1.5 py-1 ${
                              selectedShiftId === shift.id
                                ? "ring-1 ring-cyan-400/60"
                                : ""
                            } ${
                              shift.shift_source === "standard_hours"
                                ? "bg-cyan-950/50 text-cyan-100"
                                : shift.shift_source === "copy_week"
                                  ? "bg-violet-950/40 text-violet-100"
                                  : "bg-emerald-950/40 text-emerald-100"
                            }`}
                          >
                            <span className="block text-[10px] font-medium capitalize">
                              {shift.shift_type.replace(/_/g, " ")}
                            </span>
                            <span className="block text-[10px] opacity-80">
                              {formatShiftTime(shift.starts_at)}–{formatShiftTime(shift.ends_at)}
                            </span>
                            <span className="block text-[9px] opacity-60">
                              {shiftSourceDisplayLabel(shift.shift_source)}
                            </span>
                          </span>
                        ))}
                        {cellBlocks.map((block) => (
                          <span
                            key={block.blockId}
                            className="block rounded-md bg-rose-950/40 px-1.5 py-1 text-[10px] text-rose-200"
                          >
                            {blockTypeDisplayLabel(
                              block.blockType as import("@/src/lib/workforce-os/workforceRosteringEngine").AvailabilityBlockType
                            )}
                          </span>
                        ))}
                        {rdo ? (
                          <span className="block rounded-md bg-white/[0.03] px-1.5 py-1 text-[10px] text-slate-500">
                            RDO
                          </span>
                        ) : null}
                        {cellShifts.length === 0 && cellBlocks.length === 0 && !rdo ? (
                          <span className="block px-1 py-2 text-[10px] text-slate-600">+ Add shift</span>
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
