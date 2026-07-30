/**
 * Blocker ageing + business-hour helpers (1A.3).
 *
 * Rules:
 * - Store timestamps in UTC.
 * - Evolved programme business hours use Australia/Brisbane.
 * - Paused enrolments may pause selected operational timers.
 * - Critical identity / integrity timers never pause.
 * - Do not hard-code Friday/weekend/holiday without a calendar contract —
 *   business-hour calc uses Mon–Fri 09:00–17:00 Brisbane only as a documented default.
 */

import { EVOLVED_PILOT_CLINIC_TIMEZONE } from "../pilotControlContracts";
import type { BlockerProgrammeContext, PilotBlockerCandidate } from "./blockerTypes";

export const EVOLVED_BUSINESS_HOUR_CONTRACT = {
  timezone: EVOLVED_PILOT_CLINIC_TIMEZONE,
  weekdays: [1, 2, 3, 4, 5] as const, // Mon–Fri (JS: 0=Sun)
  startHour: 9,
  endHour: 17,
  holidays: [] as string[], // empty until calendar contract exists
  notes:
    "No public-holiday calendar is contracted in 1A.3. Weekend exclusion uses weekday numbers only.",
};

export function ageSecondsUtc(firstDetectedAt: string, asOf: string): number {
  const ms = Date.parse(asOf) - Date.parse(firstDetectedAt);
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor(ms / 1000));
}

function partsInTimezone(iso: string, timeZone: string): {
  weekday: number;
  hour: number;
  minute: number;
  dayKey: string;
} {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value])
  ) as Record<string, string>;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  return {
    weekday: weekdayMap[parts.weekday ?? "Mon"] ?? 1,
    hour,
    minute: Number(parts.minute ?? "0"),
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/**
 * Approximate business-seconds between two UTC instants in the clinic timezone.
 * Excludes weekends; does not exclude holidays (no calendar contract).
 */
export function businessSecondsBetween(
  fromIso: string,
  toIso: string,
  timeZone: string = EVOLVED_PILOT_CLINIC_TIMEZONE
): number {
  const start = Date.parse(fromIso);
  const end = Date.parse(toIso);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;

  const stepMs = 15 * 60 * 1000; // 15-minute buckets
  let businessMs = 0;
  for (let t = start; t < end; t += stepMs) {
    const sliceEnd = Math.min(t + stepMs, end);
    const mid = new Date((t + sliceEnd) / 2).toISOString();
    const p = partsInTimezone(mid, timeZone);
    const isWeekday = (EVOLVED_BUSINESS_HOUR_CONTRACT.weekdays as readonly number[]).includes(
      p.weekday
    );
    const minutes = p.hour * 60 + p.minute;
    const startM = EVOLVED_BUSINESS_HOUR_CONTRACT.startHour * 60;
    const endM = EVOLVED_BUSINESS_HOUR_CONTRACT.endHour * 60;
    if (isWeekday && minutes >= startM && minutes < endM) {
      businessMs += sliceEnd - t;
    }
  }
  return Math.floor(businessMs / 1000);
}

export function businessDaysBetween(
  fromIso: string,
  toIso: string,
  timeZone: string = EVOLVED_PILOT_CLINIC_TIMEZONE
): number {
  return businessSecondsBetween(fromIso, toIso, timeZone) / (8 * 3600);
}

/**
 * Effective age for escalation timers.
 * Critical integrity timers never pause.
 * Patient-action / optional operational timers pause when enrolment is paused.
 */
export function effectiveAgeSeconds(args: {
  firstDetectedAt: string;
  asOf: string;
  candidate: PilotBlockerCandidate;
  programme: BlockerProgrammeContext;
  /** When enrolment was paused (ISO); used to freeze eligible timers. */
  pausedAt?: string | null;
}): number {
  const absolute = ageSecondsUtc(args.firstDetectedAt, args.asOf);
  if (args.candidate.criticalIntegrity) return absolute;
  if (
    args.candidate.dimension === "identity" &&
    (args.candidate.baseSeverity === "critical" || args.candidate.criticalIntegrity)
  ) {
    return absolute;
  }

  const pausable =
    args.candidate.category === "patient_action_overdue" ||
    args.candidate.category === "patient_activation" ||
    args.candidate.category === "communication" ||
    args.candidate.category === "notification_delivery";

  if (args.programme.enrolmentPaused && pausable) {
    const pausePoint = args.pausedAt ?? args.asOf;
    return ageSecondsUtc(args.firstDetectedAt, pausePoint);
  }

  return absolute;
}
