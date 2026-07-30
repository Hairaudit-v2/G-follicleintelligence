/**
 * Pure readiness evaluation from an injectable source bag.
 * Server loaders populate the bag; tests supply fixtures. No writes.
 */

import { resolveIdentitySignals } from "./adapters/identityReadinessAdapter";
import { resolveClinicalSignals } from "./adapters/clinicalReadinessAdapter";
import { resolveFinancialSignals } from "./adapters/financialReadinessAdapter";
import { resolvePatientSignals } from "./adapters/patientReadinessAdapter";
import { resolveOperationalSignals } from "./adapters/operationalReadinessAdapter";
import { resolveTechnicalSignals } from "./adapters/technicalReadinessAdapter";
import { composeDimensionState } from "./composeDimensionState";
import { assemblePilotPatientReadiness } from "./composeOverallReadiness";
import { resolvePilotJourneyStage } from "./readinessMilestones";
import type { PilotReadinessSourceBag } from "./readinessSourceBag";
import type { PilotPatientReadiness } from "./readinessTypes";
import { READINESS_EVALUATION_VERSION } from "./readinessTypes";

export type EvaluateFromSourcesOptions = {
  realPatientInvitesEnabled?: boolean;
};

/**
 * Deterministic readiness evaluation. Same bag → identical output.
 * Identity gate runs first; critical identity overrides other dimensions to blocked.
 */
export function evaluatePilotPatientReadinessFromSources(
  bag: PilotReadinessSourceBag,
  options?: EvaluateFromSourcesOptions
): PilotPatientReadiness {
  const evaluatedAt = bag.evaluatedAt;
  const stage = resolvePilotJourneyStage({
    enrolmentStatus: bag.enrolmentStatus,
    milestones: bag.journey.milestones,
  });

  const identity = resolveIdentitySignals({
    bag: bag.identity,
    enrolmentPatientId: bag.patientId,
    enrolmentTenantId: bag.tenantId,
    evaluatedAt,
  });

  const clinicalRaw = resolveClinicalSignals({
    bag: bag.pathology,
    stage,
    evaluatedAt,
  });
  const financialRaw = resolveFinancialSignals({
    bag: bag.financial,
    enrolmentPatientId: bag.patientId,
    stage,
    evaluatedAt,
  });
  const patientRaw = resolvePatientSignals({
    enrolmentStatus: bag.enrolmentStatus,
    appActivated: bag.identity.appAuthUserId != null,
    realPatientInvitesEnabled: options?.realPatientInvitesEnabled ?? false,
    consent: bag.consentDocuments,
    images: bag.images,
    journey: bag.journey,
    stage,
    patientInactiveAttentionDays: bag.patientInactiveAttentionDays,
    evaluatedAt,
  });
  const operationalRaw = resolveOperationalSignals({
    appointments: bag.appointments,
    journey: bag.journey,
    consent: bag.consentDocuments,
    stage,
    evaluatedAt,
  });
  const technicalRaw = resolveTechnicalSignals({
    bag: bag.technical,
    escalateAfterFailures: bag.technicalFailureEscalateThreshold,
    evaluatedAt,
  });

  // Identity critical also forces technical / overall blocked via identityIntegrityBlocked.
  if (identity.criticalIntegrity || bag.technical.crossPatientTechnicalLinkage) {
    // already reflected in blockers
  }

  const identityBlocked =
    identity.identityIntegrityBlocked || bag.technical.crossPatientTechnicalLinkage;

  // Identity signals are surfaced on the clinical dimension for provenance (gate is not a 6th dimension).
  const clinical = composeDimensionState({
    dimension: "clinical",
    signals: [...identity.signals, ...clinicalRaw.signals],
    blockers: [...identity.blockers, ...clinicalRaw.blockers],
    warnings: clinicalRaw.warnings,
    evaluatedAt,
    forceBlocked: identityBlocked,
  });

  const financial = composeDimensionState({
    dimension: "financial",
    signals: financialRaw.signals,
    blockers: financialRaw.blockers,
    warnings: financialRaw.warnings,
    evaluatedAt,
    forceBlocked: identityBlocked,
  });
  const patient = composeDimensionState({
    dimension: "patient",
    signals: patientRaw.signals,
    blockers: patientRaw.blockers,
    warnings: patientRaw.warnings,
    evaluatedAt,
    forceBlocked: identityBlocked,
  });
  const operational = composeDimensionState({
    dimension: "operational",
    signals: operationalRaw.signals,
    blockers: operationalRaw.blockers,
    warnings: operationalRaw.warnings,
    evaluatedAt,
    forceBlocked: identityBlocked,
  });
  const technical = composeDimensionState({
    dimension: "technical",
    signals: technicalRaw.signals,
    blockers: technicalRaw.blockers,
    warnings: technicalRaw.warnings,
    evaluatedAt,
    forceBlocked: identityBlocked || bag.technical.crossPatientTechnicalLinkage,
  });

  return assemblePilotPatientReadiness({
    programmeId: bag.programmeId,
    enrolmentId: bag.enrolmentId,
    tenantId: bag.tenantId,
    patientId: bag.patientId,
    journeyStage: stage,
    clinical,
    financial,
    patient,
    operational,
    technical,
    identityIntegrityBlocked: identityBlocked,
    technicalAttention: technicalRaw.technicalAttention || identity.criticalIntegrity,
    enrolmentCompleted: bag.enrolmentStatus === "completed",
    evaluatedAt,
  });
}

export function readinessEvaluationVersion(): string {
  return READINESS_EVALUATION_VERSION;
}
