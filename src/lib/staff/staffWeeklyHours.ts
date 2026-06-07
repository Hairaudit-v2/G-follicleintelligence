/**
 * Weekly working hours for `fi_staff.working_hours` (JSON object).
 * Wall times are interpreted in the staff member's `default_timezone`
 * (fallback {@link DEFAULT_STAFF_HOURS_FALLBACK_TZ} when unset).
 */

import { normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";

export const DEFAULT_STAFF_HOURS_FALLBACK_TZ = "Australia/Perth";

export const STAFF_WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type StaffWeekdayKey = (typeof STAFF_WEEKDAY_KEYS)[number];

export type StaffDayHours = {
  /** When false or omitted with empty times, treat as closed. */
  enabled?: boolean;
  /** Local wall time `HH:mm` in staff TZ. */
  start?: string;
  end?: string;
};

export type StaffWeeklyHoursMap = Partial<Record<StaffWeekdayKey, StaffDayHours>>;

export type StaffWorkingHoursDocument = {
  weekly?: StaffWeeklyHoursMap;
};

const DAY_LABEL: Record<StaffWeekdayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHm(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!HM_RE.test(s)) return null;
  return s;
}

function dayHoursFromUnknown(raw: unknown): StaffDayHours | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const start = parseHm(o.start);
  const end = parseHm(o.end);
  const enabled = typeof o.enabled === "boolean" ? o.enabled : start != null && end != null;
  if (!enabled && !start && !end) return { enabled: false };
  return { enabled, start: start ?? undefined, end: end ?? undefined };
}

/** Normalise DB `working_hours` into a weekday map (unknown keys ignored). */
export function parseStaffWeeklyHours(workingHours: Record<string, unknown> | null | undefined): StaffWeeklyHoursMap {
  if (!workingHours || typeof workingHours !== "object" || Array.isArray(workingHours)) return {};
  const w = (workingHours as StaffWorkingHoursDocument).weekly;
  if (!w || typeof w !== "object" || Array.isArray(w)) return {};
  const out: StaffWeeklyHoursMap = {};
  for (const key of STAFF_WEEKDAY_KEYS) {
    const slice = (w as Record<string, unknown>)[key];
    const parsed = dayHoursFromUnknown(slice);
    if (parsed) out[key] = parsed;
  }
  return out;
}

export function serializeStaffWeeklyHours(weekly: StaffWeeklyHoursMap): StaffWorkingHoursDocument {
  const weeklyOut: StaffWeeklyHoursMap = {};
  for (const key of STAFF_WEEKDAY_KEYS) {
    const d = weekly[key];
    if (!d) continue;
    const enabled = d.enabled !== false;
    const start = parseHm(d.start ?? "");
    const end = parseHm(d.end ?? "");
    if (!enabled) {
      weeklyOut[key] = { enabled: false };
      continue;
    }
    if (start && end) weeklyOut[key] = { enabled: true, start, end };
  }
  return { weekly: weeklyOut };
}

/** Typical Perth clinic week for Evolved-style tenants (wall times AWST). */
export function defaultPerthClinicWeeklyHours(): StaffWeeklyHoursMap {
  return {
    mon: { enabled: true, start: "08:30", end: "17:30" },
    tue: { enabled: true, start: "08:30", end: "17:30" },
    wed: { enabled: true, start: "08:30", end: "17:30" },
    thu: { enabled: true, start: "08:30", end: "17:30" },
    fri: { enabled: true, start: "08:30", end: "17:30" },
    sat: { enabled: false },
    sun: { enabled: false },
  };
}

export function minutesFromHm(hm: string): number | null {
  const m = HM_RE.exec(hm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Weekday index Mon=0 … Sun=6 in `staffTz` for instant `ms`. */
export function staffWeekdayKeyFromUtcMs(ms: number, staffTz: string): StaffWeekdayKey {
  const tz = normalizeCalendarTimezone(staffTz);
  const dtf = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz });
  const w = dtf.formatToParts(new Date(ms)).find((p) => p.type === "weekday")?.value;
  const map: Record<string, StaffWeekdayKey> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
    Sun: "sun",
  };
  return map[w ?? ""] ?? "mon";
}

/** Minutes since local midnight in `staffTz` for UTC instant `ms`. */
export function staffLocalMinutesFromUtcMs(ms: number, staffTz: string): number | null {
  const tz = normalizeCalendarTimezone(staffTz);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(ms)).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );
  const h = Number(parts.hour);
  const m = Number(parts.minute);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function timeZoneShortLabel(timeZone: string, refMs: number = Date.now()): string {
  const tz = normalizeCalendarTimezone(timeZone);
  try {
    const dtf = new Intl.DateTimeFormat("en-AU", { timeZone: tz, timeZoneName: "short" });
    const name =
      dtf.formatToParts(new Date(refMs)).find((p) => p.type === "timeZoneName")?.value?.trim() || tz;
    return name;
  } catch {
    return tz;
  }
}

function daySummary(d: StaffDayHours | undefined): string | null {
  if (!d || d.enabled === false) return null;
  const a = d.start?.trim();
  const b = d.end?.trim();
  if (!a || !b) return null;
  return `${a}–${b}`;
}

/** One-line summary of configured weekly hours (closed days omitted). */
export function formatStaffWeeklyHoursSummary(weekly: StaffWeeklyHoursMap): string {
  const parts: string[] = [];
  for (const key of STAFF_WEEKDAY_KEYS) {
    const line = daySummary(weekly[key]);
    if (line) parts.push(`${DAY_LABEL[key]} ${line}`);
  }
  return parts.length ? parts.join("; ") : "";
}

export function isUtcRangeWithinStaffWeeklyHours(
  startMs: number,
  endMs: number,
  weekly: StaffWeeklyHoursMap,
  staffTz: string
): boolean {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return false;
  if (staffWeekdayKeyFromUtcMs(startMs, staffTz) !== staffWeekdayKeyFromUtcMs(endMs - 1, staffTz)) return false;
  const key = staffWeekdayKeyFromUtcMs(startMs, staffTz);
  const day = weekly[key];
  const sm = day?.start ? minutesFromHm(day.start) : null;
  const em = day?.end ? minutesFromHm(day.end) : null;
  if (!day || day.enabled === false || sm == null || em == null || em <= sm) return false;
  const startMin = staffLocalMinutesFromUtcMs(startMs, staffTz);
  const endMin = staffLocalMinutesFromUtcMs(endMs - 1, staffTz);
  if (startMin == null || endMin == null) return false;
  return startMin >= sm && endMin < em;
}

export type StaffHoursHintInput = {
  staffDefaultTimezone: string | null | undefined;
  workingHours: Record<string, unknown> | null | undefined;
  /** Tenant clinic calendar IANA zone (datetime-local fields). */
  tenantCalendarTimezone: string;
  /** UTC ISO start/end when checking the selected slot (optional). */
  candidateStartIso?: string | null;
  candidateEndIso?: string | null;
};

/**
 * Hint for booking UIs: describes weekly wall hours in staff TZ (Perth fallback)
 * and optionally whether the candidate range falls inside those hours (same calendar day in staff TZ).
 */
export function buildStaffBookingAvailabilityHint(input: StaffHoursHintInput): string {
  const weekly = parseStaffWeeklyHours(input.workingHours ?? undefined);
  const staffTz = normalizeCalendarTimezone(
    input.staffDefaultTimezone?.trim() || DEFAULT_STAFF_HOURS_FALLBACK_TZ
  );
  const clinicTz = normalizeCalendarTimezone(input.tenantCalendarTimezone);
  const tzShort = timeZoneShortLabel(staffTz);
  const summary = formatStaffWeeklyHoursSummary(weekly);

  let base: string;
  if (!summary) {
    base = `No weekly hours on file for this staff member. Hours (if set later) use ${staffTz} (${tzShort}).`;
  } else {
    base = `Typical hours (${tzShort}): ${summary}.`;
  }

  const a = input.candidateStartIso?.trim();
  const b = input.candidateEndIso?.trim();
  if (!a || !b) {
    return `${base} Form uses clinic timezone ${clinicTz}.`;
  }
  const s = Date.parse(a);
  const e = Date.parse(b);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
    return `${base} Form uses clinic timezone ${clinicTz}.`;
  }
  const inside = isUtcRangeWithinStaffWeeklyHours(s, e, weekly, staffTz);
  const slotNote = summary
    ? inside
      ? " Selected slot falls within those hours (same local day)."
      : " Selected slot may fall outside those usual hours — confirm with the clinician."
    : "";
  return `${base} Form uses clinic timezone ${clinicTz}.${slotNote}`;
}
