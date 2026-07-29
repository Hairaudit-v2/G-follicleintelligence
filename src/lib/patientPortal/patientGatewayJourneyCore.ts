/**
 * FI-PATIENT-APP-1D — patient-safe journey translation (pure).
 * Maps FiOS PatientJourneyState → stable patient-facing vocabulary.
 * Never exposes staff hrefs, blocker kinds, or internal workflow names.
 */

import type {
  PatientJourneySignals,
  PatientJourneyState,
} from "@/src/lib/patientJourney/patientJourneyStateCore";

export const PATIENT_GATEWAY_JOURNEY_STAGES = [
  "consultation",
  "treatment",
  "procedure",
  "recovery",
  "review",
  "audit",
] as const;

export type PatientGatewayJourneyStage = (typeof PATIENT_GATEWAY_JOURNEY_STAGES)[number];

export type PatientGatewayJourneyStepStatus = "completed" | "current" | "upcoming";

export type PatientGatewayJourneyStep = {
  key: PatientGatewayJourneyStage;
  label: string;
  status: PatientGatewayJourneyStepStatus;
  completedAt: string | null;
};

export type PatientGatewayNextActionType =
  | "attend_appointment"
  | "upload_images"
  | "request_review"
  | "await_clinic"
  | "review_quote"
  | "pay_deposit"
  | "complete_blood_tests"
  | "sign_document"
  | "none";

export type PatientGatewayNextAction = {
  type: PatientGatewayNextActionType;
  label: string;
  dueAt: string | null;
  actionKey: string;
  actionId?: string;
  deepLinkKey?: string;
  resourceId?: string;
};

export type PatientGatewayMilestone = {
  key: string;
  status: string;
  responsibleRole: string;
  dueAt: string | null;
  completedAt: string | null;
  patientLabel: string;
  linkedResourceType: string | null;
  linkedResourceId: string | null;
  primaryActionId: string | null;
};

export type PatientGatewayJourneyResponse = {
  ok: true;
  stage: PatientGatewayJourneyStage;
  stageLabel: string;
  progress: {
    currentStep: number;
    totalSteps: number;
  };
  steps: PatientGatewayJourneyStep[];
  nextAction: PatientGatewayNextAction;
  milestones: PatientGatewayMilestone[];
};

export type PatientGatewayJourneyAppointmentHint = {
  id: string;
  startAt: string;
  type: string;
  title: string;
};

const STAGE_LABELS: Record<PatientGatewayJourneyStage, string> = {
  consultation: "Consultation",
  treatment: "Treatment planning",
  procedure: "Procedure",
  recovery: "Recovery",
  review: "Review",
  audit: "Audit",
};

/** Deterministic FiOS → patient stage mapping. */
export function mapFiJourneyStateToPatientStage(
  state: PatientJourneyState
): PatientGatewayJourneyStage {
  switch (state) {
    case "lead":
    case "inactive":
    case "lost":
    case "consult_booked":
    case "consult_completed":
      return "consultation";
    case "treatment_recommended":
    case "quote_sent":
    case "quote_accepted":
    case "deposit_paid":
      return "treatment";
    case "surgery_booked":
    case "pre_op_incomplete":
    case "pre_op_ready":
    case "procedure_day":
      return "procedure";
    case "procedure_completed":
    case "post_op_follow_up_due":
      return "recovery";
    case "three_month_review_due":
    case "six_month_review_due":
      return "review";
    case "twelve_month_audit_due":
    case "completed":
      return "audit";
  }
}

export function patientStageLabel(
  stage: PatientGatewayJourneyStage,
  state: PatientJourneyState
): string {
  if (state === "lost") return "Paused";
  if (state === "inactive") return "Getting started";
  if (state === "completed") return "Complete";
  if (state === "post_op_follow_up_due") return "Recovery";
  if (state === "three_month_review_due") return "3 Month Review";
  if (state === "six_month_review_due") return "6 Month Review";
  if (state === "twelve_month_audit_due") return "12 Month Audit";
  return STAGE_LABELS[stage];
}

function stageIndex(stage: PatientGatewayJourneyStage): number {
  return PATIENT_GATEWAY_JOURNEY_STAGES.indexOf(stage);
}

export function buildPatientGatewayJourneySteps(
  stage: PatientGatewayJourneyStage
): PatientGatewayJourneyStep[] {
  const current = stageIndex(stage);
  return PATIENT_GATEWAY_JOURNEY_STAGES.map((key, idx) => ({
    key,
    label: STAGE_LABELS[key],
    status: idx < current ? "completed" : idx === current ? "current" : "upcoming",
    completedAt: null,
  }));
}

function earliestUpcoming(
  appointments: readonly PatientGatewayJourneyAppointmentHint[],
  nowMs: number
): PatientGatewayJourneyAppointmentHint | null {
  let best: PatientGatewayJourneyAppointmentHint | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const a of appointments) {
    const ms = Date.parse(a.startAt);
    if (!Number.isFinite(ms) || ms < nowMs) continue;
    if (ms < bestMs) {
      best = a;
      bestMs = ms;
    }
  }
  return best;
}

/**
 * Server-authoritative next action for the patient home screen.
 * Priority is fixed for determinism.
 */
export function derivePatientGatewayNextAction(input: {
  state: PatientJourneyState;
  signals: Pick<
    PatientJourneySignals,
    "imagingComplete" | "followUpBooked" | "postOpFollowUpDue" | "threeMonthReviewDue" | "sixMonthReviewDue" | "twelveMonthAuditDue"
  >;
  upcomingAppointments: readonly PatientGatewayJourneyAppointmentHint[];
  nowIso: string;
}): PatientGatewayNextAction {
  const nowMs = Date.parse(input.nowIso);
  const upcoming = earliestUpcoming(input.upcomingAppointments, nowMs);
  if (upcoming) {
    return {
      type: "attend_appointment",
      label: `Attend your ${upcoming.title}`,
      dueAt: upcoming.startAt,
      actionKey: `appointment:${upcoming.id}`,
    };
  }

  const reviewDue =
    input.signals.postOpFollowUpDue ||
    input.signals.threeMonthReviewDue ||
    input.signals.sixMonthReviewDue ||
    input.signals.twelveMonthAuditDue ||
    input.state === "post_op_follow_up_due" ||
    input.state === "three_month_review_due" ||
    input.state === "six_month_review_due" ||
    input.state === "twelve_month_audit_due";

  if (reviewDue && !input.signals.followUpBooked) {
    return {
      type: "request_review",
      label: "Request a review appointment",
      dueAt: null,
      actionKey: "request_review",
    };
  }

  const needsProgressImages =
    !input.signals.imagingComplete &&
    (input.state === "pre_op_incomplete" ||
      input.state === "pre_op_ready" ||
      input.state === "procedure_completed" ||
      input.state === "post_op_follow_up_due" ||
      input.state === "three_month_review_due" ||
      input.state === "six_month_review_due" ||
      input.state === "twelve_month_audit_due");

  if (needsProgressImages) {
    return {
      type: "upload_images",
      label: "Upload your progress photos",
      dueAt: null,
      actionKey: "progress_images",
    };
  }

  if (input.state === "completed") {
    return {
      type: "none",
      label: "You are all caught up",
      dueAt: null,
      actionKey: "none",
    };
  }

  if (
    input.state === "quote_sent" ||
    input.state === "quote_accepted" ||
    input.state === "deposit_paid" ||
    input.state === "treatment_recommended" ||
    input.state === "lead" ||
    input.state === "inactive" ||
    input.state === "lost" ||
    input.state === "consult_completed"
  ) {
    return {
      type: "await_clinic",
      label: "Your clinic will be in touch with next steps",
      dueAt: null,
      actionKey: "await_clinic",
    };
  }

  return {
    type: "none",
    label: "You are all caught up",
    dueAt: null,
    actionKey: "none",
  };
}

/** Build the patient-safe journey response from an already-derived FiOS state. */
export function buildPatientGatewayJourneyResponse(input: {
  state: PatientJourneyState;
  signals: PatientJourneySignals;
  upcomingAppointments: readonly PatientGatewayJourneyAppointmentHint[];
  nowIso: string;
  milestones?: PatientGatewayMilestone[];
  primaryActionOverride?: PatientGatewayNextAction;
}): PatientGatewayJourneyResponse {
  const stage = mapFiJourneyStateToPatientStage(input.state);
  const steps = buildPatientGatewayJourneySteps(stage);
  const currentStep = stageIndex(stage) + 1;
  return {
    ok: true,
    stage,
    stageLabel: patientStageLabel(stage, input.state),
    progress: {
      currentStep,
      totalSteps: PATIENT_GATEWAY_JOURNEY_STAGES.length,
    },
    steps,
    nextAction:
      input.primaryActionOverride ??
      derivePatientGatewayNextAction({
        state: input.state,
        signals: input.signals,
        upcomingAppointments: input.upcomingAppointments,
        nowIso: input.nowIso,
      }),
    milestones: input.milestones ?? [],
  };
}

/** True when a payload exposes staff/internal workflow fields (test helper). */
export function journeyResponseExposesInternalWorkflow(payload: Record<string, unknown>): boolean {
  const forbiddenKeys = [
    "derivedState",
    "manuallyOverridden",
    "blockers",
    "nextBestAction",
    "href",
    "internalNote",
  ];
  // Fragments only — do not forbid milestone keys quote_sent / deposit_paid.
  const forbiddenFragments = [
    "fi-admin",
    "unpaid_deposit",
    "missing_consent",
    "pre_op_incomplete",
  ];

  function hasForbiddenKey(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(hasForbiddenKey);
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (forbiddenKeys.includes(key)) return true;
      if (hasForbiddenKey(obj[key])) return true;
    }
    return false;
  }

  if (hasForbiddenKey(payload)) return true;
  const serialized = JSON.stringify(payload);
  return forbiddenFragments.some((f) => serialized.includes(f));
}
