/**
 * FI-UX-REBUILD-1 S3.2 — Front Desk Today presentation contract.
 * Pure types only. No React, no server-only, no loaders.
 */

import type { ReceptionOperationalState } from "@/src/lib/fiOs/receptionBoardModel";

export type FrontDeskTodayLaneId =
  | "running_late"
  | "arriving_soon"
  | "waiting"
  | "in_consultation"
  | "in_treatment"
  | "completed";

export type FrontDeskSeverity = "blocker" | "action_needed" | "information";

export type FrontDeskPaymentState = "paid" | "due" | "overdue" | "not_required" | "unknown";

export type FrontDeskCardActionId =
  | "check_in"
  | "start_consultation"
  | "start_treatment"
  | "complete"
  | "no_show"
  | "cancel"
  | "take_payment"
  | "find_patient"
  | "open_patient"
  | "open_calendar";

export type FrontDeskMutationMode = "full" | "pin_reception" | "none";

export type FrontDeskCardBlocker = {
  /** Stable within a card: `${severity}:${kind}:${sourceId}`. */
  id: string;
  kind: string;
  label: string;
  severity: FrontDeskSeverity;
  href: string | null;
};

export type FrontDeskTodayCard = {
  bookingId: string;
  patient: {
    displayName: string;
    patientId: string | null;
    leadId: string | null;
  };
  appointment: {
    startAtIso: string;
    endAtIso: string;
    startTimeLabel: string;
    durationMinutes: number | null;
    typeLabel: string;
  };
  resource: {
    clinicianLabel: string;
    roomLabel: string | null;
    clinicLabel: string | null;
  };
  operationalState: ReceptionOperationalState;
  laneId: FrontDeskTodayLaneId | null;
  runningLate: boolean;
  /** Minutes since arrival; null unless a real arrival instant exists in metadata. */
  waitingMinutes: number | null;
  payment: { state: FrontDeskPaymentState; label: string };
  blocker: {
    highest: FrontDeskSeverity | null;
    summary: string | null;
    items: FrontDeskCardBlocker[];
  };
  contact: { hasEmail: boolean; hasPhone: boolean } | null;
  allowedActions: FrontDeskCardActionId[];
  links: {
    patient: string | null;
    appointment: string;
    calendar: string;
  };
};

export type FrontDeskTodayLane = {
  id: FrontDeskTodayLaneId;
  label: string;
  cards: FrontDeskTodayCard[];
  count: number;
  collapsedByDefault: boolean;
};

export type FrontDeskAttentionItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  severity: FrontDeskSeverity;
  href: string | null;
  bookingId: string | null;
  patientId: string | null;
  priorityScore: number;
};

export type FrontDeskTodaySummary = {
  total: number;
  arrivingSoon: number;
  expected: number;
  runningLate: number;
  waiting: number;
  inConsultation: number;
  inTreatment: number;
  completed: number;
  cancelledOrNoShow: number;
  paymentAttention: number;
  blockers: number;
};

export type FrontDeskTodayGlobalAction = {
  id: "take_payment" | "find_patient" | "new_booking" | "open_calendar";
  label: string;
  href: string;
};

/** Prep checklist risk for today's board (from booking.metadata.scheduling_prep). */
export type FrontDeskPrepRiskItem = {
  id: string;
  bookingId: string;
  patientName: string;
  patientId: string | null;
  startAtIso: string;
  startTimeLabel: string;
  openCount: number;
  attentionCount: number;
  topLabels: string[];
  severity: FrontDeskSeverity;
  summary: string;
  href: string | null;
};

export type FrontDeskTodayPresentation = {
  generatedAt: string;
  operationalDay: {
    calendarTimezone: string;
    todayYmd: string;
  };
  loadTier: "shell" | "full";
  lanes: FrontDeskTodayLane[];
  /** Cancelled / no-show cards (collapsed exception section; not active lanes). */
  exceptionCards: {
    cancelled: FrontDeskTodayCard[];
    noShow: FrontDeskTodayCard[];
  };
  attentionItems: FrontDeskAttentionItem[];
  attentionSummary: {
    total: number;
    visible: number;
    hidden: number;
  };
  /**
   * Smart Scheduling prep open items for today's active appointments.
   * Empty when no bookings carry `metadata.scheduling_prep` yet.
   */
  prepRiskItems: FrontDeskPrepRiskItem[];
  summary: FrontDeskTodaySummary;
  actions: FrontDeskTodayGlobalAction[];
};
