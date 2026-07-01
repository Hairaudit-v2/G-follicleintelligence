/**
 * WorkforceOS roster vs actual punch variance (pure logic).
 */

export const ROSTER_VARIANCE_KINDS = [
  "on_time",
  "early_in",
  "late_in",
  "early_out",
  "late_out",
  "no_punch",
  "unscheduled_punch",
] as const;
export type RosterVarianceKind = (typeof ROSTER_VARIANCE_KINDS)[number];

export type RosterShiftSnapshot = {
  shiftId: string;
  fiStaffId: string;
  staffFullName: string | null;
  workDate: string;
  shiftStartsAt: string;
  shiftEndsAt: string;
  shiftType: string;
};

export type PunchSnapshot = {
  punchId: string;
  fiStaffId: string;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  minutesWorked: number | null;
};

export type RosterActualVarianceRow = {
  kind: RosterVarianceKind;
  shiftId: string | null;
  punchId: string | null;
  fiStaffId: string;
  staffFullName: string | null;
  workDate: string;
  shiftStartsAt: string | null;
  shiftEndsAt: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  varianceMinutes: number | null;
  summary: string;
};

const DEFAULT_GRACE_MINUTES = 10;

function minuteDelta(actualIso: string, expectedIso: string): number {
  const a = new Date(actualIso).getTime();
  const e = new Date(expectedIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(e)) return 0;
  return Math.round((a - e) / 60_000);
}

export function compareShiftToPunch(
  shift: RosterShiftSnapshot,
  punch: PunchSnapshot | null,
  graceMinutes = DEFAULT_GRACE_MINUTES
): RosterActualVarianceRow {
  if (!punch) {
    return {
      kind: "no_punch",
      shiftId: shift.shiftId,
      punchId: null,
      fiStaffId: shift.fiStaffId,
      staffFullName: shift.staffFullName,
      workDate: shift.workDate,
      shiftStartsAt: shift.shiftStartsAt,
      shiftEndsAt: shift.shiftEndsAt,
      clockInAt: null,
      clockOutAt: null,
      varianceMinutes: null,
      summary: "Rostered shift with no PIN punch recorded.",
    };
  }

  const inDelta = minuteDelta(punch.clockInAt, shift.shiftStartsAt);
  const outDelta =
    punch.clockOutAt != null ? minuteDelta(punch.clockOutAt, shift.shiftEndsAt) : null;

  let kind: RosterVarianceKind = "on_time";
  let varianceMinutes: number | null = 0;
  let summary = "Within grace window.";

  if (inDelta < -graceMinutes) {
    kind = "early_in";
    varianceMinutes = inDelta;
    summary = `Clocked in ${Math.abs(inDelta)} min early.`;
  } else if (inDelta > graceMinutes) {
    kind = "late_in";
    varianceMinutes = inDelta;
    summary = `Clocked in ${inDelta} min late.`;
  } else if (outDelta != null && outDelta < -graceMinutes) {
    kind = "early_out";
    varianceMinutes = outDelta;
    summary = `Clocked out ${Math.abs(outDelta)} min early.`;
  } else if (outDelta != null && outDelta > graceMinutes) {
    kind = "late_out";
    varianceMinutes = outDelta;
    summary = `Clocked out ${outDelta} min late (overtime).`;
  }

  return {
    kind,
    shiftId: shift.shiftId,
    punchId: punch.punchId,
    fiStaffId: shift.fiStaffId,
    staffFullName: shift.staffFullName,
    workDate: shift.workDate,
    shiftStartsAt: shift.shiftStartsAt,
    shiftEndsAt: shift.shiftEndsAt,
    clockInAt: punch.clockInAt,
    clockOutAt: punch.clockOutAt,
    varianceMinutes,
    summary,
  };
}

export function buildRosterActualVarianceReport(input: {
  shifts: RosterShiftSnapshot[];
  punches: PunchSnapshot[];
  graceMinutes?: number;
}): RosterActualVarianceRow[] {
  const grace = input.graceMinutes ?? DEFAULT_GRACE_MINUTES;
  const punchesByStaffDate = new Map<string, PunchSnapshot[]>();
  for (const p of input.punches) {
    const key = `${p.fiStaffId}:${p.workDate}`;
    const list = punchesByStaffDate.get(key) ?? [];
    list.push(p);
    punchesByStaffDate.set(key, list);
  }

  const matchedPunchIds = new Set<string>();
  const rows: RosterActualVarianceRow[] = [];

  for (const shift of input.shifts) {
    const key = `${shift.fiStaffId}:${shift.workDate}`;
    const candidates = punchesByStaffDate.get(key) ?? [];
    const punch = candidates[0] ?? null;
    if (punch) matchedPunchIds.add(punch.punchId);
    rows.push(compareShiftToPunch(shift, punch, grace));
  }

  for (const p of input.punches) {
    if (matchedPunchIds.has(p.punchId)) continue;
    rows.push({
      kind: "unscheduled_punch",
      shiftId: null,
      punchId: p.punchId,
      fiStaffId: p.fiStaffId,
      staffFullName: null,
      workDate: p.workDate,
      shiftStartsAt: null,
      shiftEndsAt: null,
      clockInAt: p.clockInAt,
      clockOutAt: p.clockOutAt,
      varianceMinutes: p.minutesWorked,
      summary: "PIN punch with no matching roster shift.",
    });
  }

  return rows.sort((a, b) => {
    const d = b.workDate.localeCompare(a.workDate);
    if (d !== 0) return d;
    return (a.staffFullName ?? "").localeCompare(b.staffFullName ?? "");
  });
}