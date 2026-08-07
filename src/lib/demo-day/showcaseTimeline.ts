/**
 * FI-DEMO-DAY-2A.1 — Deterministic relative-date helpers for the James Chen lifecycle spine.
 *
 * All “today” resolution flows through an explicit anchor (instant + Australia/Sydney).
 * Callers must not hard-code wall-clock calendar dates in seed code.
 */

import {
  addDaysToCalendarDate,
  calendarDateStringFromInstant,
  isoFromLocalDayMinutes,
  normalizeCalendarTimezone,
  zonedMidnightUtcMs,
} from "@/src/lib/calendar/calendarTimezone";

import {
  SHOWCASE_JAMES_CHEN_AGE_YEARS,
  SHOWCASE_TIMEZONE,
  type ShowcaseDemoPackage,
} from "./showcaseJamesChenConstants";

export type ShowcaseTimelineAnchor = {
  /** Instant used as Demo Day “now” (typically `new Date()` at seed time). */
  now: Date;
  /** IANA zone — must be Australia/Sydney for James. */
  timeZone: string;
};

export type ShowcaseLifecycleMilestoneId =
  | "lead"
  | "consultation"
  | "hli_baseline"
  | "medical_start"
  | "quote"
  | "deposit"
  | "surgical_plan"
  | "projected_outcome"
  | "consent"
  | "medical_end"
  | "procedure"
  | "immediate_imaging"
  | "observed_outcome_3m"
  | "observed_outcome_6m"
  | "workforce_on_procedure"
  | "economics_balance";

export type ShowcaseMilestoneKind = "absolute_day" | "relative_month";

export type ShowcaseLifecycleMilestoneSpec = {
  id: ShowcaseLifecycleMilestoneId;
  label: string;
  kind: ShowcaseMilestoneKind;
  /**
   * Days from Demo Day anchor (negative = past, positive = future).
   * Ignored when `kind === "relative_month"`.
   */
  dayOffset?: number;
  /** When kind is relative_month, anchor milestone id (resolved first). */
  relativeTo?: ShowcaseLifecycleMilestoneId;
  monthOffset?: number;
  /** Local hour on the resolved calendar day (0–23). */
  localHour: number;
  localMinute?: number;
};

/**
 * Ordered lifecycle spine from FI-DEMO-DAY-2A §4.2.
 * Observed outcomes are procedure + 3m / +6m (typically future relative to Demo Day).
 */
export const SHOWCASE_LIFECYCLE_MILESTONE_SPECS: readonly ShowcaseLifecycleMilestoneSpec[] = [
  {
    id: "lead",
    label: "Lead / web enquiry",
    kind: "absolute_day",
    dayOffset: -90,
    localHour: 10,
  },
  {
    id: "consultation",
    label: "Consultation completed",
    kind: "absolute_day",
    dayOffset: -75,
    localHour: 11,
  },
  {
    id: "hli_baseline",
    label: "HLI assessment / clinical risk",
    kind: "absolute_day",
    dayOffset: -74,
    localHour: 14,
  },
  {
    id: "medical_start",
    label: "Medical / adjunct therapy start",
    kind: "absolute_day",
    dayOffset: -60,
    localHour: 9,
  },
  {
    id: "quote",
    label: "Surgical quote issued",
    kind: "absolute_day",
    dayOffset: -45,
    localHour: 15,
  },
  {
    id: "deposit",
    label: "Surgery deposit paid",
    kind: "absolute_day",
    dayOffset: -40,
    localHour: 12,
  },
  {
    id: "surgical_plan",
    label: "Approved hairline + graft allocation",
    kind: "absolute_day",
    dayOffset: -21,
    localHour: 10,
  },
  {
    id: "projected_outcome",
    label: "Projected outcome (plan window)",
    kind: "absolute_day",
    dayOffset: -20,
    localHour: 16,
  },
  {
    id: "consent",
    label: "Consent + clinical approvals",
    kind: "absolute_day",
    dayOffset: -14,
    localHour: 11,
  },
  {
    id: "medical_end",
    label: "Pre-op medical course complete",
    kind: "absolute_day",
    dayOffset: -14,
    localHour: 17,
  },
  {
    id: "procedure",
    label: "Surgery-day clinical record",
    kind: "absolute_day",
    dayOffset: -7,
    localHour: 8,
  },
  {
    id: "immediate_imaging",
    label: "Immediate post-op imaging",
    kind: "absolute_day",
    dayOffset: -7,
    localHour: 16,
  },
  {
    id: "workforce_on_procedure",
    label: "Team competencies valid on procedure date",
    kind: "absolute_day",
    dayOffset: -7,
    localHour: 7,
  },
  {
    id: "observed_outcome_3m",
    label: "Observed growth / density (3 months)",
    kind: "relative_month",
    relativeTo: "procedure",
    monthOffset: 3,
    localHour: 10,
  },
  {
    id: "observed_outcome_6m",
    label: "Observed outcome / satisfaction (6 months)",
    kind: "relative_month",
    relativeTo: "procedure",
    monthOffset: 6,
    localHour: 10,
  },
  {
    id: "economics_balance",
    label: "Procedure balance / contribution",
    kind: "absolute_day",
    dayOffset: -6,
    localHour: 9,
  },
] as const;

export type ShowcaseResolvedMilestone = {
  id: ShowcaseLifecycleMilestoneId;
  label: string;
  /** Clinic-local calendar day YYYY-MM-DD */
  ymd: string;
  /** ISO-8601 UTC instant for the milestone wall time */
  iso: string;
  /** Days from Demo Day calendar date to this milestone’s ymd (signed). */
  dayDeltaFromAnchor: number;
  isPast: boolean;
  isFuture: boolean;
  isAnchorDay: boolean;
};

export type ShowcaseMilestoneSchedule = {
  anchor: ShowcaseTimelineAnchor;
  anchorYmd: string;
  milestones: ShowcaseResolvedMilestone[];
  byId: Record<ShowcaseLifecycleMilestoneId, ShowcaseResolvedMilestone>;
};

export function createShowcaseTimelineAnchor(
  now: Date = new Date(),
  timeZone: string = SHOWCASE_TIMEZONE
): ShowcaseTimelineAnchor {
  const tz = normalizeCalendarTimezone(timeZone);
  if (tz !== SHOWCASE_TIMEZONE) {
    throw new Error(
      `James Chen showcase timeline requires ${SHOWCASE_TIMEZONE}; received ${tz}`
    );
  }
  return { now, timeZone: tz };
}

/** Demo Day calendar date in the showcase timezone. */
export function showcaseAnchorYmd(anchor: ShowcaseTimelineAnchor): string {
  return calendarDateStringFromInstant(anchor.now, anchor.timeZone);
}

/**
 * Calendar day offset from Demo Day (negative = past). Does not hard-code “today”.
 */
export function showcaseYmdAtDayOffset(
  anchor: ShowcaseTimelineAnchor,
  dayOffset: number
): string {
  return addDaysToCalendarDate(showcaseAnchorYmd(anchor), dayOffset, anchor.timeZone);
}

export function showcaseInstantAtDayOffset(
  anchor: ShowcaseTimelineAnchor,
  dayOffset: number,
  localHour: number,
  localMinute = 0
): string {
  const ymd = showcaseYmdAtDayOffset(anchor, dayOffset);
  const minutes = localHour * 60 + localMinute;
  const iso = isoFromLocalDayMinutes(ymd, minutes, anchor.timeZone);
  if (!iso) {
    throw new Error(
      `Failed to resolve showcase instant for ${ymd} @ ${localHour}:${String(localMinute).padStart(2, "0")} ${anchor.timeZone}`
    );
  }
  return iso;
}

/**
 * Birth date such that James is exactly {@link SHOWCASE_JAMES_CHEN_AGE_YEARS}
 * on the Demo Day calendar date (same month-day as anchor).
 */
export function showcaseBirthDateYmd(anchor: ShowcaseTimelineAnchor): string {
  const ymd = showcaseAnchorYmd(anchor);
  const [y, m, d] = ymd.split("-").map(Number);
  const birthYear = y - SHOWCASE_JAMES_CHEN_AGE_YEARS;
  return `${String(birthYear).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Add calendar months while preserving day-of-month when possible.
 * Clamps to the last valid day of the target month (e.g. 31 Jan + 1m → 28/29 Feb).
 * Local to demo-day — does not change shared `addMonthsToCalendarDate` (month-start semantics).
 */
export function showcaseAddMonthsPreservingDay(
  ymd: string,
  monthOffset: number,
  timeZone: string
): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    throw new Error(`Invalid YMD for showcase month math: ${ymd}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]); // 1–12
  const day = Number(match[3]);
  const targetIndex = month - 1 + monthOffset;
  const targetYear = year + Math.floor(targetIndex / 12);
  const targetMonthZero = ((targetIndex % 12) + 12) % 12; // 0–11
  const targetMonth = targetMonthZero + 1;
  // Last day of target month via UTC Date (calendar day count, zone-independent).
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  const out = `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
  // Validate the civil date exists in the target zone (DST / parse guard).
  const ms = zonedMidnightUtcMs(out, tz);
  if (ms == null) {
    throw new Error(`showcaseAddMonthsPreservingDay produced unresolvable date ${out} in ${tz}`);
  }
  return out;
}

export function signedDayDeltaBetweenYmd(
  fromYmd: string,
  toYmd: string,
  timeZone: string
): number {
  const tz = normalizeCalendarTimezone(timeZone);
  if (fromYmd === toYmd) return 0;
  const fromMs = zonedMidnightUtcMs(fromYmd, tz);
  const toMs = zonedMidnightUtcMs(toYmd, tz);
  if (fromMs == null || toMs == null) {
    throw new Error(`Could not compute day delta from ${fromYmd} to ${toYmd} in ${tz}`);
  }
  // Local midnights: divide by 86_400_000 then round — DST makes some civil days ≠ 24h,
  // but the calendar-day count is still the rounded instant distance for AU zones.
  return Math.round((toMs - fromMs) / 86_400_000);
}

function resolveAbsoluteMilestone(
  anchor: ShowcaseTimelineAnchor,
  spec: ShowcaseLifecycleMilestoneSpec
): ShowcaseResolvedMilestone {
  if (spec.dayOffset == null) {
    throw new Error(`Milestone ${spec.id} missing dayOffset`);
  }
  const ymd = showcaseYmdAtDayOffset(anchor, spec.dayOffset);
  const iso = showcaseInstantAtDayOffset(
    anchor,
    spec.dayOffset,
    spec.localHour,
    spec.localMinute ?? 0
  );
  const dayDeltaFromAnchor = spec.dayOffset;
  return {
    id: spec.id,
    label: spec.label,
    ymd,
    iso,
    dayDeltaFromAnchor,
    isPast: dayDeltaFromAnchor < 0,
    isFuture: dayDeltaFromAnchor > 0,
    isAnchorDay: dayDeltaFromAnchor === 0,
  };
}

/**
 * Build the full ordered schedule. Relative-month milestones resolve after their anchors.
 */
export function buildShowcaseMilestoneSchedule(
  anchor: ShowcaseTimelineAnchor = createShowcaseTimelineAnchor()
): ShowcaseMilestoneSchedule {
  const anchorYmd = showcaseAnchorYmd(anchor);
  const byId = {} as Record<ShowcaseLifecycleMilestoneId, ShowcaseResolvedMilestone>;
  const milestones: ShowcaseResolvedMilestone[] = [];

  for (const spec of SHOWCASE_LIFECYCLE_MILESTONE_SPECS) {
    if (spec.kind === "absolute_day") {
      const resolved = resolveAbsoluteMilestone(anchor, spec);
      byId[spec.id] = resolved;
      milestones.push(resolved);
      continue;
    }

    if (!spec.relativeTo || spec.monthOffset == null) {
      throw new Error(`Relative milestone ${spec.id} requires relativeTo + monthOffset`);
    }
    const base = byId[spec.relativeTo];
    if (!base) {
      throw new Error(
        `Milestone ${spec.id} relativeTo ${spec.relativeTo} not resolved yet — check spec order`
      );
    }
    const ymd = showcaseAddMonthsPreservingDay(base.ymd, spec.monthOffset, anchor.timeZone);
    const minutes = spec.localHour * 60 + (spec.localMinute ?? 0);
    const iso = isoFromLocalDayMinutes(ymd, minutes, anchor.timeZone);
    if (!iso) {
      throw new Error(`Failed to resolve relative milestone ${spec.id} on ${ymd}`);
    }
    const dayDeltaFromAnchor = signedDayDeltaBetweenYmd(anchorYmd, ymd, anchor.timeZone);
    const resolved: ShowcaseResolvedMilestone = {
      id: spec.id,
      label: spec.label,
      ymd,
      iso,
      dayDeltaFromAnchor,
      isPast: dayDeltaFromAnchor < 0,
      isFuture: dayDeltaFromAnchor > 0,
      isAnchorDay: dayDeltaFromAnchor === 0,
    };
    byId[spec.id] = resolved;
    milestones.push(resolved);
  }

  return { anchor, anchorYmd, milestones, byId };
}

/** Chronological order by ISO instant (stable tie-break on id). */
export function orderShowcaseMilestonesByInstant(
  milestones: readonly ShowcaseResolvedMilestone[]
): ShowcaseResolvedMilestone[] {
  return [...milestones].sort((a, b) => {
    const cmp = a.iso.localeCompare(b.iso);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
}

/** True when re-building schedule for the same anchor yields identical ids/ymds/isos. */
export function showcaseSchedulesEqual(
  a: ShowcaseMilestoneSchedule,
  b: ShowcaseMilestoneSchedule
): boolean {
  if (a.anchorYmd !== b.anchorYmd) return false;
  if (a.milestones.length !== b.milestones.length) return false;
  for (let i = 0; i < a.milestones.length; i++) {
    const x = a.milestones[i]!;
    const y = b.milestones[i]!;
    if (x.id !== y.id || x.ymd !== y.ymd || x.iso !== y.iso) return false;
  }
  return true;
}

/** Convenience for seeds: schedule for package timezone (must be Sydney). */
export function buildShowcaseScheduleForPackage(
  pkg: ShowcaseDemoPackage,
  now: Date = new Date()
): ShowcaseMilestoneSchedule {
  void pkg; // packages share the same Sydney spine in 2A.1
  return buildShowcaseMilestoneSchedule(createShowcaseTimelineAnchor(now, SHOWCASE_TIMEZONE));
}
