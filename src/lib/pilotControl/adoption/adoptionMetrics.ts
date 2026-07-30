/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6 — adoption metric aggregation (pure).
 * Replay-safe via idempotency keys. Live and synthetic evidence are separated.
 */

import type { PilotEnrolmentStatus } from "../pilotControlContracts";
import { isLivePilotEvidence, type PilotEvidenceSourceClass } from "../readiness/cohortReadinessSummary";
import {
  computeRateMetric,
  metricNumber,
  type PilotAdoptionEvent,
  type PilotMetric,
  type PilotMetricConfidence,
  PILOT_ADOPTION_METRIC_VERSION,
} from "./adoptionTypes";

export type EnrolmentAdoptionInput = {
  id: string;
  patientId: string;
  enrolmentStatus: PilotEnrolmentStatus;
  invitedAt: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  withdrawnAt: string | null;
  pausedAt: string | null;
  evidenceClass: PilotEvidenceSourceClass;
};

export type BlockerAdoptionInput = {
  state: string;
  severity: string;
  ageSeconds: number;
  firstDetectedAt: string;
  lastConfirmedAt: string;
  criticalIntegrity?: boolean;
  evidenceClass?: PilotEvidenceSourceClass;
};

export type PilotCohortAdoptionMetrics = {
  approvedPatients: PilotMetric<number>;
  invitedPatients: PilotMetric<number>;
  activatedPatients: PilotMetric<number>;
  activePatients: PilotMetric<number>;
  completedPatients: PilotMetric<number>;
  withdrawnPatients: PilotMetric<number>;
  activationRate: PilotMetric<number | null>;
  completionRate: PilotMetric<number | null>;
};

export type PilotPatientAdoptionMetrics = {
  medianInviteToActivationHours: PilotMetric<number | null>;
  patientActionsCreated: PilotMetric<number>;
  patientActionsCompleted: PilotMetric<number>;
  patientActionCompletionRate: PilotMetric<number | null>;
  overduePatientActions: PilotMetric<number>;
  inactivePatients: PilotMetric<number>;
  notificationDeliveryRate: PilotMetric<number | null>;
};

export type PilotStaffAdoptionMetrics = {
  controlCentreOpeners: PilotMetric<number>;
  clinicActionsCompleted: PilotMetric<number>;
  overdueClinicActions: PilotMetric<number>;
  patientDetailViews: PilotMetric<number>;
  exportUses: PilotMetric<number>;
  manualFallbackCount: PilotMetric<number>;
};

export type PilotJourneyAdoptionMetrics = {
  milestonesStarted: PilotMetric<number>;
  milestonesCompleted: PilotMetric<number>;
  patientsStalled: PilotMetric<number>;
  blockedMilestones: PilotMetric<number>;
  journeyCompletionRate: PilotMetric<number | null>;
};

export type PilotFinanceAdoptionMetrics = {
  quotesDelivered: PilotMetric<number>;
  quotesViewed: PilotMetric<number>;
  quotesAccepted: PilotMetric<number>;
  depositsRequested: PilotMetric<number>;
  paymentsVerified: PilotMetric<number>;
  reconciliationExceptions: PilotMetric<number>;
  financialClearanceAchieved: PilotMetric<number>;
};

export type PilotEvidenceCompletionMetrics = {
  documentsRequested: PilotMetric<number>;
  documentsCompleted: PilotMetric<number>;
  consentCompleted: PilotMetric<number>;
  imagesCompleted: PilotMetric<number>;
  pathologyWorkflowCompletion: PilotMetric<number>;
};

export type PilotCommunicationMetrics = {
  messagesReceived: PilotMetric<number>;
  messagesReplied: PilotMetric<number>;
  notificationsSent: PilotMetric<number>;
  notificationsDelivered: PilotMetric<number>;
  notificationsFailed: PilotMetric<number>;
};

export type PilotReliabilityMetrics = {
  technicalErrors: PilotMetric<number>;
  partialReadinessEvaluations: PilotMetric<number>;
  failedReadinessEvaluations: PilotMetric<number>;
  identityIntegrityBlockers: PilotMetric<number>;
};

export type PilotBlockerAdoptionMetrics = {
  newBlockers: PilotMetric<number>;
  resolvedBlockers: PilotMetric<number>;
  openBacklog: PilotMetric<number>;
  medianBlockerAgeSeconds: PilotMetric<number | null>;
  oldestBlockerAgeSeconds: PilotMetric<number | null>;
  criticalBlockers: PilotMetric<number>;
  highBlockers: PilotMetric<number>;
  resolutionRate: PilotMetric<number | null>;
};

export type PilotAdoptionResponse = {
  programmeId: string;
  tenantId: string;
  cohort: PilotCohortAdoptionMetrics;
  patient: PilotPatientAdoptionMetrics;
  staff: PilotStaffAdoptionMetrics;
  journey: PilotJourneyAdoptionMetrics;
  finance: PilotFinanceAdoptionMetrics;
  evidence: PilotEvidenceCompletionMetrics;
  communication: PilotCommunicationMetrics;
  reliability: PilotReliabilityMetrics;
  blockers: PilotBlockerAdoptionMetrics;
  confidence: {
    overall: PilotMetricConfidence;
    missingEvents: string[];
    syntheticEventCount: number;
    liveEventCount: number;
  };
  evaluatedAt: string;
  metricVersion: string;
};

/** Deduplicate events by idempotencyKey or eventId (stable). */
export function dedupeAdoptionEvents(
  events: readonly PilotAdoptionEvent[]
): PilotAdoptionEvent[] {
  const seen = new Set<string>();
  const out: PilotAdoptionEvent[] = [];
  for (const e of events) {
    const key = (e.idempotencyKey?.trim() || e.eventId).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/** Exclude automatic polling page views from staff adoption. */
export function isAutomaticPollingAdoptionEvent(event: PilotAdoptionEvent): boolean {
  const meta = event.metadataClass?.toLowerCase() ?? "";
  return meta === "automatic_refresh" || meta === "polling" || meta === "auto_refresh";
}

function countEvents(
  events: readonly PilotAdoptionEvent[],
  types: readonly string[]
): number {
  const set = new Set(types);
  return events.filter((e) => set.has(e.eventType)).length;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function countConfidence(args: {
  liveEnrolments: number;
  liveEvents: number;
  syntheticOnly: boolean;
  missingCritical: boolean;
}): PilotMetricConfidence {
  if (args.syntheticOnly && args.liveEnrolments === 0) return "synthetic_only";
  if (args.liveEnrolments === 0 && args.liveEvents === 0) return "insufficient_evidence";
  if (args.missingCritical) return "live_partial";
  if (args.liveEvents === 0 && args.liveEnrolments > 0) return "live_partial";
  return "live_verified";
}

const MISSING_EVENT_CANDIDATES = [
  "patient_action_completed",
  "clinic_action_completed",
  "notification_delivered",
  "manual_channel_fallback_recorded",
  "quote_delivered",
  "journey_milestone_completed",
  "blocker_resolved",
] as const;

export function computePilotAdoptionMetrics(args: {
  programmeId: string;
  tenantId: string;
  enrolments: readonly EnrolmentAdoptionInput[];
  events: readonly PilotAdoptionEvent[];
  blockers: readonly BlockerAdoptionInput[];
  evaluatedAt?: string;
  partialReadinessEvaluations?: number;
  failedReadinessEvaluations?: number;
}): PilotAdoptionResponse {
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const liveEnrolments = args.enrolments.filter((e) => isLivePilotEvidence(e.evidenceClass));
  const syntheticEnrolments = args.enrolments.filter((e) => !isLivePilotEvidence(e.evidenceClass));

  const deduped = dedupeAdoptionEvents(args.events).filter(
    (e) => e.tenantId === args.tenantId && e.programmeId === args.programmeId
  );

  const liveEvents = deduped.filter(
    (e) => !e.evidenceClass || isLivePilotEvidence(e.evidenceClass)
  );
  const syntheticEvents = deduped.filter(
    (e) => e.evidenceClass && !isLivePilotEvidence(e.evidenceClass)
  );

  // Staff adoption ignores automatic polling.
  const staffEvents = liveEvents.filter((e) => !isAutomaticPollingAdoptionEvent(e));

  const syntheticOnly =
    liveEnrolments.length === 0 &&
    (syntheticEnrolments.length > 0 || syntheticEvents.length > 0);

  const presentTypes = new Set(liveEvents.map((e) => e.eventType));
  const missingEvents = MISSING_EVENT_CANDIDATES.filter((k) => !presentTypes.has(k));

  const conf = countConfidence({
    liveEnrolments: liveEnrolments.length,
    liveEvents: liveEvents.length,
    syntheticOnly,
    missingCritical: missingEvents.length >= 4,
  });

  const baseConf: PilotMetricConfidence = conf;

  const srcEnrolment = ["fi_pilot_enrolments"];
  const srcEvents = ["fi_pilot_control_events"];
  const srcBlockers = ["fi_pilot_blockers"];

  const approved = liveEnrolments.filter((e) =>
    ["approved", "invited", "activated", "active", "paused", "completed"].includes(
      e.enrolmentStatus
    )
  ).length;
  const invited = liveEnrolments.filter(
    (e) =>
      e.enrolmentStatus === "invited" ||
      e.invitedAt != null ||
      ["activated", "active", "paused", "completed"].includes(e.enrolmentStatus)
  ).length;
  const activated = liveEnrolments.filter(
    (e) =>
      e.activatedAt != null ||
      ["activated", "active", "paused", "completed"].includes(e.enrolmentStatus)
  ).length;
  const active = liveEnrolments.filter((e) => e.enrolmentStatus === "active").length;
  const completed = liveEnrolments.filter((e) => e.enrolmentStatus === "completed").length;
  const withdrawn = liveEnrolments.filter((e) => e.enrolmentStatus === "withdrawn").length;

  // Activation rate: activated / invited (not approved).
  const activationRate = computeRateMetric(activated, invited, {
    source: srcEnrolment,
    evaluatedAt,
    confidence: baseConf,
  });

  // Journey completion: completed / activated (active-or-completed pool).
  const completionDenom = liveEnrolments.filter((e) =>
    ["activated", "active", "completed"].includes(e.enrolmentStatus)
  ).length;
  const completionRate = computeRateMetric(completed, completionDenom, {
    source: srcEnrolment,
    evaluatedAt,
    confidence: baseConf,
  });

  const inviteToActivationHours: number[] = [];
  for (const e of liveEnrolments) {
    if (!e.invitedAt || !e.activatedAt) continue;
    const a = Date.parse(e.invitedAt);
    const b = Date.parse(e.activatedAt);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) continue;
    inviteToActivationHours.push((b - a) / (1000 * 60 * 60));
  }

  const patientCreated = countEvents(liveEvents, ["patient_action_created"]);
  const patientCompleted = countEvents(liveEvents, ["patient_action_completed"]);
  // Optional actions must not dilute: only required actions with due outcome.
  const patientOverdue = countEvents(liveEvents, ["patient_action_overdue"]);
  const patientDue = patientCompleted + patientOverdue;
  const patientCompletionRate = computeRateMetric(patientCompleted, patientDue, {
    source: srcEvents,
    evaluatedAt,
    confidence: liveEvents.length === 0 ? "insufficient_evidence" : baseConf,
  });

  const notifSent = countEvents(liveEvents, ["notification_sent"]);
  const notifDelivered = countEvents(liveEvents, ["notification_delivered"]);
  const notifFailed = countEvents(liveEvents, ["notification_failed"]);
  const notifOutcomes = notifDelivered + notifFailed;
  // Delivery rate: delivered / attempts with a delivery outcome (not sent alone).
  const notifDeliveryRate = computeRateMetric(notifDelivered, notifOutcomes, {
    source: srcEvents,
    evaluatedAt,
    confidence: notifOutcomes === 0 ? "insufficient_evidence" : baseConf,
    warning: notifSent > 0 && notifOutcomes === 0 ? "delivery_outcome_missing" : undefined,
  });

  const liveBlockers = args.blockers.filter(
    (b) => !b.evidenceClass || isLivePilotEvidence(b.evidenceClass)
  );
  const openBlockers = liveBlockers.filter((b) =>
    ["open", "acknowledged", "in_progress"].includes(b.state)
  );
  const resolvedBlockers = liveBlockers.filter((b) => b.state === "resolved");
  const ages = openBlockers.map((b) => b.ageSeconds).filter((n) => Number.isFinite(n));
  const newBlockers = countEvents(liveEvents, ["blocker_opened"]);
  const resolvedEvents = countEvents(liveEvents, ["blocker_resolved"]);
  const resolutionDenom = newBlockers + resolvedEvents;
  const resolutionRate = computeRateMetric(resolvedEvents, Math.max(resolutionDenom, openBlockers.length + resolvedBlockers.length), {
    source: [...srcEvents, ...srcBlockers],
    evaluatedAt,
    confidence: liveBlockers.length === 0 && liveEvents.length === 0 ? "insufficient_evidence" : baseConf,
  });

  const n = (value: number, source: string[], warning?: string): PilotMetric<number> =>
    metricNumber(value, {
      confidence: baseConf,
      source,
      evaluatedAt,
      warning,
    }) as PilotMetric<number>;

  return {
    programmeId: args.programmeId,
    tenantId: args.tenantId,
    cohort: {
      approvedPatients: n(approved, srcEnrolment),
      invitedPatients: n(invited, srcEnrolment),
      activatedPatients: n(activated, srcEnrolment),
      activePatients: n(active, srcEnrolment),
      completedPatients: n(completed, srcEnrolment),
      withdrawnPatients: n(withdrawn, srcEnrolment),
      activationRate,
      completionRate,
    },
    patient: {
      medianInviteToActivationHours: metricNumber(median(inviteToActivationHours), {
        confidence: inviteToActivationHours.length === 0 ? "insufficient_evidence" : baseConf,
        source: srcEnrolment,
        evaluatedAt,
      }),
      patientActionsCreated: n(patientCreated, srcEvents),
      patientActionsCompleted: n(patientCompleted, srcEvents),
      patientActionCompletionRate: patientCompletionRate,
      overduePatientActions: n(patientOverdue, srcEvents),
      inactivePatients: n(
        liveEnrolments.filter((e) => e.enrolmentStatus === "paused").length,
        srcEnrolment
      ),
      notificationDeliveryRate: notifDeliveryRate,
    },
    staff: {
      controlCentreOpeners: n(
        new Set(
          staffEvents
            .filter((e) => e.eventType === "pilot_control_overview_viewed")
            .map((e) => e.actorId)
            .filter(Boolean)
        ).size,
        srcEvents
      ),
      clinicActionsCompleted: n(countEvents(liveEvents, ["clinic_action_completed"]), srcEvents),
      overdueClinicActions: n(countEvents(liveEvents, ["clinic_action_overdue"]), srcEvents),
      patientDetailViews: n(
        countEvents(staffEvents, ["pilot_control_patient_detail_viewed"]),
        srcEvents
      ),
      exportUses: n(countEvents(staffEvents, ["pilot_control_export_created"]), srcEvents),
      manualFallbackCount: n(
        countEvents(liveEvents, ["manual_channel_fallback_recorded"]),
        srcEvents
      ),
    },
    journey: {
      milestonesStarted: n(countEvents(liveEvents, ["journey_milestone_started"]), srcEvents),
      milestonesCompleted: n(countEvents(liveEvents, ["journey_milestone_completed"]), srcEvents),
      patientsStalled: n(countEvents(liveEvents, ["journey_milestone_blocked", "workflow_abandoned"]), srcEvents),
      blockedMilestones: n(countEvents(liveEvents, ["journey_milestone_blocked"]), srcEvents),
      journeyCompletionRate: completionRate,
    },
    finance: {
      quotesDelivered: n(countEvents(liveEvents, ["quote_delivered"]), srcEvents),
      quotesViewed: n(countEvents(liveEvents, ["quote_viewed"]), srcEvents),
      quotesAccepted: n(countEvents(liveEvents, ["quote_accepted"]), srcEvents),
      depositsRequested: n(countEvents(liveEvents, ["deposit_requested"]), srcEvents),
      paymentsVerified: n(countEvents(liveEvents, ["payment_verified"]), srcEvents),
      reconciliationExceptions: n(
        countEvents(liveEvents, ["payment_reconciliation_required"]),
        srcEvents
      ),
      financialClearanceAchieved: n(
        countEvents(liveEvents, ["financial_clearance_achieved"]),
        srcEvents
      ),
    },
    evidence: {
      documentsRequested: n(countEvents(liveEvents, ["document_requested"]), srcEvents),
      documentsCompleted: n(countEvents(liveEvents, ["document_completed"]), srcEvents),
      consentCompleted: n(countEvents(liveEvents, ["consent_completed"]), srcEvents),
      imagesCompleted: n(countEvents(liveEvents, ["images_completed"]), srcEvents),
      pathologyWorkflowCompletion: n(
        countEvents(liveEvents, ["pathology_cleared"]),
        srcEvents
      ),
    },
    communication: {
      messagesReceived: n(countEvents(liveEvents, ["message_received"]), srcEvents),
      messagesReplied: n(countEvents(liveEvents, ["message_replied"]), srcEvents),
      notificationsSent: n(notifSent, srcEvents),
      notificationsDelivered: n(notifDelivered, srcEvents),
      notificationsFailed: n(notifFailed, srcEvents),
    },
    reliability: {
      technicalErrors: n(countEvents(liveEvents, ["technical_error_detected"]), srcEvents),
      partialReadinessEvaluations: n(args.partialReadinessEvaluations ?? 0, [
        "canonical_batch_readiness",
      ]),
      failedReadinessEvaluations: n(args.failedReadinessEvaluations ?? 0, [
        "canonical_batch_readiness",
      ]),
      identityIntegrityBlockers: n(
        liveBlockers.filter((b) => b.criticalIntegrity).length,
        srcBlockers
      ),
    },
    blockers: {
      newBlockers: n(newBlockers, srcEvents),
      resolvedBlockers: n(resolvedEvents || resolvedBlockers.length, [...srcEvents, ...srcBlockers]),
      openBacklog: n(openBlockers.length, srcBlockers),
      medianBlockerAgeSeconds: metricNumber(median(ages), {
        confidence: ages.length === 0 ? "insufficient_evidence" : baseConf,
        source: srcBlockers,
        evaluatedAt,
      }),
      oldestBlockerAgeSeconds: metricNumber(ages.length ? Math.max(...ages) : null, {
        confidence: ages.length === 0 ? "insufficient_evidence" : baseConf,
        source: srcBlockers,
        evaluatedAt,
      }),
      criticalBlockers: n(openBlockers.filter((b) => b.severity === "critical").length, srcBlockers),
      highBlockers: n(openBlockers.filter((b) => b.severity === "high").length, srcBlockers),
      resolutionRate,
    },
    confidence: {
      overall: baseConf,
      missingEvents: [...missingEvents],
      syntheticEventCount: syntheticEvents.length,
      liveEventCount: liveEvents.length,
    },
    evaluatedAt,
    metricVersion: PILOT_ADOPTION_METRIC_VERSION,
  };
}
