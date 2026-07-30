/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.1 — blocker + escalation rules (pure).
 */

import {
  DEFAULT_PILOT_ESCALATION_THRESHOLDS,
  type PilotBlockerCategory,
  type PilotBlockerOwner,
  type PilotBlockerResolutionState,
  type PilotBlockerSeverity,
  type PilotEscalationLevel,
  type PilotEscalationThresholds,
  type PilotSourceModule,
} from "./pilotControlContracts";

/**
 * Minimal blocker shape for 1A.1 health composition.
 * Full operational records live in blockers/blockerTypes.ts (1A.3).
 */
export type PilotHealthBlockerSnapshot = {
  id: string;
  tenantId: string;
  patientId: string;
  category: PilotBlockerCategory;
  severity: PilotBlockerSeverity;
  sourceModule: PilotSourceModule;
  sourceRecordType: string | null;
  sourceRecordId: string | null;
  firstDetectedAt: string;
  lastConfirmedAt: string;
  owner: PilotBlockerOwner;
  recommendedNextAction: string;
  resolutionState: PilotBlockerResolutionState;
  /** When true, this blocker is a critical safety / integrity fail-closed condition. */
  criticalIntegrity: boolean;
};

/** @deprecated Use PilotHealthBlockerSnapshot or 1A.3 PilotBlockerRecord. */
export type PilotBlockerRecord = PilotHealthBlockerSnapshot;

/** Accepts 1A.1 snapshots or 1A.3 operational records for health rollups. */
export type PilotHealthBlockerLike = {
  severity: PilotBlockerSeverity;
  resolutionState?: PilotBlockerResolutionState | string;
  state?: PilotBlockerResolutionState | string;
  criticalIntegrity?: boolean;
};

export function mergeEscalationThresholds(
  overrides?: Partial<PilotEscalationThresholds> | null
): PilotEscalationThresholds {
  return { ...DEFAULT_PILOT_ESCALATION_THRESHOLDS, ...(overrides ?? {}) };
}

export type EscalationSignalInput = {
  patientActionOverdueHours: number | null;
  clinicActionOverdueBusinessDays: number | null;
  patientInactiveDays: number | null;
  unreadPatientMessageBusinessHours: number | null;
  surgeryWithinDays: number | null;
  missingRequiredConsent: boolean;
  missingFinancialClearance: boolean;
  pathologyUnresolved: boolean;
  identityMismatch: boolean;
  crossTenantIdentityConcern: boolean;
  wrongPatientLinkage: boolean;
  failedNotificationPastRetry: boolean;
  blockedDays: number | null;
  readinessIncorrectlyRepresented: boolean;
  paymentAllocatedWrongPatient: boolean;
  consentWrongPatient: boolean;
  patientDataAccessCrossPatient: boolean;
  procedureMarkedReadyDespiteMandatoryBlocker: boolean;
};

function hoursBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / (1000 * 60 * 60);
}

export function ageHours(firstDetectedAt: string, nowIso: string): number {
  return Math.max(0, hoursBetween(firstDetectedAt, nowIso));
}

/**
 * Deterministic escalation level from signals + configurable thresholds.
 * Critical conditions always win; score never downgrades a critical.
 */
export function deriveEscalationLevel(
  signals: EscalationSignalInput,
  thresholds: PilotEscalationThresholds = DEFAULT_PILOT_ESCALATION_THRESHOLDS
): { level: PilotEscalationLevel; reasons: string[] } {
  const reasons: string[] = [];

  if (signals.crossTenantIdentityConcern) reasons.push("cross_tenant_identity");
  if (signals.wrongPatientLinkage) reasons.push("wrong_patient_linkage");
  if (signals.paymentAllocatedWrongPatient) reasons.push("payment_wrong_patient");
  if (signals.consentWrongPatient) reasons.push("consent_wrong_patient");
  if (signals.patientDataAccessCrossPatient) reasons.push("cross_patient_data_access");
  if (signals.procedureMarkedReadyDespiteMandatoryBlocker) {
    reasons.push("ready_despite_mandatory_blocker");
  }
  if (signals.readinessIncorrectlyRepresented) reasons.push("readiness_misrepresented");

  if (reasons.length > 0) {
    return { level: "critical", reasons };
  }

  const highReasons: string[] = [];
  if (
    signals.surgeryWithinDays != null &&
    signals.surgeryWithinDays <= thresholds.surgery_window_high_days &&
    signals.missingRequiredConsent
  ) {
    highReasons.push("surgery_window_missing_consent");
  }
  if (
    signals.surgeryWithinDays != null &&
    signals.surgeryWithinDays <= thresholds.surgery_window_high_days &&
    signals.missingFinancialClearance
  ) {
    highReasons.push("surgery_window_missing_financial_clearance");
  }
  if (signals.pathologyUnresolved) highReasons.push("pathology_unresolved");
  if (signals.identityMismatch) highReasons.push("identity_mismatch");
  if (signals.failedNotificationPastRetry) highReasons.push("notification_failed_retries");
  if (
    signals.blockedDays != null &&
    signals.blockedDays > thresholds.blocked_high_days
  ) {
    highReasons.push("blocked_exceeds_threshold");
  }

  if (highReasons.length > 0) {
    return { level: "high", reasons: highReasons };
  }

  const attentionReasons: string[] = [];
  if (
    signals.patientActionOverdueHours != null &&
    signals.patientActionOverdueHours > thresholds.patient_action_overdue_attention_hours
  ) {
    attentionReasons.push("patient_action_overdue");
  }
  if (
    signals.clinicActionOverdueBusinessDays != null &&
    signals.clinicActionOverdueBusinessDays >
      thresholds.clinic_action_overdue_attention_business_days
  ) {
    attentionReasons.push("clinic_action_overdue");
  }
  if (
    signals.patientInactiveDays != null &&
    signals.patientInactiveDays >= thresholds.patient_inactive_attention_days
  ) {
    attentionReasons.push("patient_inactive");
  }
  if (
    signals.unreadPatientMessageBusinessHours != null &&
    signals.unreadPatientMessageBusinessHours >
      thresholds.unread_message_attention_business_hours
  ) {
    attentionReasons.push("unread_patient_message");
  }

  if (attentionReasons.length > 0) {
    return { level: "attention", reasons: attentionReasons };
  }

  return { level: "none", reasons: [] };
}

export function severityFromEscalation(level: PilotEscalationLevel): PilotBlockerSeverity {
  switch (level) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "attention":
      return "attention";
    default:
      return "info";
  }
}

function lifecycleState(b: PilotHealthBlockerLike): string {
  return String(b.state ?? b.resolutionState ?? "open");
}

export function openBlockers<T extends PilotHealthBlockerLike>(
  blockers: readonly T[]
): T[] {
  return blockers.filter((b) => {
    const s = lifecycleState(b);
    return s === "open" || s === "acknowledged" || s === "in_progress";
  });
}

export function hasCriticalIntegrityBlocker(
  blockers: readonly PilotHealthBlockerLike[]
): boolean {
  return openBlockers(blockers).some(
    (b) => Boolean(b.criticalIntegrity) || b.severity === "critical"
  );
}

export function countOpenHighBlockers(
  blockers: readonly PilotHealthBlockerLike[]
): number {
  return openBlockers(blockers).filter((b) => b.severity === "high").length;
}
