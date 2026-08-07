/**
 * Pure specs for IHRG Demo Day alignment — densify Sydney Hair Institute
 * for ReceptionOS / calendar guided pitches without mutating TITAN history.
 */

export const IHRG_DEMO_DAY_CLINIC_SLUG = "sydney-hair-institute" as const;
export const IHRG_DEMO_DAY_TIMEZONE = "Australia/Sydney" as const;
export const IHRG_DEMO_DAY_KEY_METADATA = "demo_day_key" as const;
export const IHRG_DEMO_DAY_ALIGNMENT_FLAG = "ihrg_demo_day_alignment" as const;

export type IhrgDemoDayBookingKind = "consultation" | "surgery";

export type IhrgDemoDayBookingSpec = {
  /** Stable idempotency key stored on booking metadata.demo_day_key */
  key: string;
  kind: IhrgDemoDayBookingKind;
  /** Local hour on aligned day (0–23) in IHRG_DEMO_DAY_TIMEZONE */
  localHour: number;
  durationHours: number;
  /** When true, ensure a pending surgery deposit on the booking */
  withPendingDeposit: boolean;
  titleSuffix: string;
};

/**
 * Dense board for a guided Reception deep-dive after GCC:
 * morning consults + mid-day surgeries + one deposit-at-risk surgery.
 */
export const IHRG_DEMO_DAY_BOOKING_SPECS: readonly IhrgDemoDayBookingSpec[] = [
  {
    key: "ihrg-demo-day-consult-01",
    kind: "consultation",
    localHour: 9,
    durationHours: 1,
    withPendingDeposit: false,
    titleSuffix: "new consult",
  },
  {
    key: "ihrg-demo-day-consult-02",
    kind: "consultation",
    localHour: 10,
    durationHours: 1,
    withPendingDeposit: false,
    titleSuffix: "quote review",
  },
  {
    key: "ihrg-demo-day-consult-03",
    kind: "consultation",
    localHour: 11,
    durationHours: 1,
    withPendingDeposit: false,
    titleSuffix: "pre-op briefing",
  },
  {
    key: "ihrg-demo-day-surgery-01",
    kind: "surgery",
    localHour: 8,
    durationHours: 4,
    withPendingDeposit: false,
    titleSuffix: "FUE surgery day",
  },
  {
    key: "ihrg-demo-day-surgery-02",
    kind: "surgery",
    localHour: 13,
    durationHours: 4,
    withPendingDeposit: true,
    titleSuffix: "FUE surgery — deposit due",
  },
  {
    key: "ihrg-demo-day-consult-tomorrow-01",
    kind: "consultation",
    localHour: 9,
    durationHours: 1,
    withPendingDeposit: false,
    titleSuffix: "tomorrow consult hold",
  },
] as const;

/** Specs scheduled on operational "today" (Sydney). */
export function ihrgDemoDayTodaySpecs(): IhrgDemoDayBookingSpec[] {
  return IHRG_DEMO_DAY_BOOKING_SPECS.filter((s) => !s.key.includes("tomorrow"));
}

/** Specs scheduled on operational tomorrow (Sydney). */
export function ihrgDemoDayTomorrowSpecs(): IhrgDemoDayBookingSpec[] {
  return IHRG_DEMO_DAY_BOOKING_SPECS.filter((s) => s.key.includes("tomorrow"));
}

export type IhrgDemoDayReceptionTaskSpec = {
  key: string;
  title: string;
  severity: "info" | "warning";
  /** Hours from now until due_at */
  dueInHours: number;
};

export const IHRG_DEMO_DAY_RECEPTION_TASK_SPECS: readonly IhrgDemoDayReceptionTaskSpec[] = [
  {
    key: "ihrg-demo-day-task-deposit",
    title: "Confirm outstanding surgery deposit before midday case",
    severity: "warning",
    dueInHours: 2,
  },
  {
    key: "ihrg-demo-day-task-consent",
    title: "Chase signed consent for afternoon surgery",
    severity: "warning",
    dueInHours: 4,
  },
  {
    key: "ihrg-demo-day-task-pickup",
    title: "Welcome pack ready for morning new consult",
    severity: "info",
    dueInHours: 1,
  },
  {
    key: "ihrg-demo-day-task-followup",
    title: "Follow up yesterday's consult — quote outstanding",
    severity: "info",
    dueInHours: 6,
  },
] as const;
