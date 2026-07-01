/**
 * WorkforceOS PIN time clock — pure types and duration math (testable without DB).
 */

export const TIME_PUNCH_STATUSES = ["open", "closed", "void"] as const;
export type TimePunchStatus = (typeof TIME_PUNCH_STATUSES)[number];

export const TIME_PUNCH_SOURCES = ["pin", "manager_correction", "auto_close"] as const;
export type TimePunchSource = (typeof TIME_PUNCH_SOURCES)[number];

export const TIME_PUNCH_BREAK_STATUSES = ["open", "closed", "void"] as const;
export type TimePunchBreakStatus = (typeof TIME_PUNCH_BREAK_STATUSES)[number];

export type TimePunchBreak = {
  id: string;
  punchId: string;
  breakStartAt: string;
  breakEndAt: string | null;
  status: TimePunchBreakStatus;
  source: "pin" | "manager_correction";
  minutes: number | null;
  notes: string | null;
};

export type WorkforceTimePunch = {
  id: string;
  tenantId: string;
  staffMemberId: string | null;
  fiStaffId: string;
  staffFullName: string | null;
  workDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  pinSessionId: string | null;
  shiftId: string | null;
  timesheetEntryId: string | null;
  status: TimePunchStatus;
  source: TimePunchSource;
  grossMinutesWorked: number | null;
  breakMinutes: number;
  minutesWorked: number | null;
  breaks: TimePunchBreak[];
  hasOpenBreak: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClockInResult = {
  punch: WorkforceTimePunch;
  /** True when an existing open punch was resumed (re-login same day). */
  resumed: boolean;
};

export type ClockOutResult = {
  punch: WorkforceTimePunch;
  timesheetEntryId: string | null;
  /** Set when punch closed but no timesheet could be generated (e.g. missing wage profile). */
  timesheetPendingReason: string | null;
};

export type PinBreakSessionState = {
  hasOpenPunch: boolean;
  onBreak: boolean;
  punchId: string | null;
};

/** Minutes between two ISO instants; zero when invalid or non-positive span. */
export function computePunchMinutes(clockInAt: string, clockOutAt: string): number {
  const start = new Date(clockInAt).getTime();
  const end = new Date(clockOutAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

export function sumBreakMinutes(
  breaks: Array<{ breakStartAt: string; breakEndAt: string | null; status: TimePunchBreakStatus }>,
  asOfIso?: string
): number {
  let total = 0;
  for (const brk of breaks) {
    if (brk.status === "void") continue;
    const end = brk.breakEndAt ?? asOfIso ?? null;
    if (!end) continue;
    total += computePunchMinutes(brk.breakStartAt, end);
  }
  return total;
}

export function computeNetWorkMinutes(
  grossMinutes: number,
  breakMinutes: number
): number {
  return Math.max(0, Math.floor(grossMinutes) - Math.max(0, Math.floor(breakMinutes)));
}

/** Whether PIN login should open a new punch (no open punch for this staff). */
export function shouldOpenNewPunchOnLogin(hasOpenPunch: boolean): boolean {
  return !hasOpenPunch;
}

export function deriveGrossMinutesWorked(
  status: TimePunchStatus,
  clockInAt: string,
  clockOutAt: string | null
): number | null {
  if (status === "open" || !clockOutAt) return null;
  return computePunchMinutes(clockInAt, clockOutAt);
}

export function deriveNetMinutesWorked(
  status: TimePunchStatus,
  clockInAt: string,
  clockOutAt: string | null,
  breakMinutes: number
): number | null {
  const gross = deriveGrossMinutesWorked(status, clockInAt, clockOutAt);
  if (gross == null) return null;
  return computeNetWorkMinutes(gross, breakMinutes);
}

export function derivePunchMinutesWorked(
  status: TimePunchStatus,
  clockInAt: string,
  clockOutAt: string | null,
  breakMinutes = 0
): number | null {
  return deriveNetMinutesWorked(status, clockInAt, clockOutAt, breakMinutes);
}