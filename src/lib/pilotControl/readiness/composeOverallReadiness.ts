/**
 * Bridge 1A.2 dimension results → frozen deriveOverallReadiness (1A.1).
 */

import {
  deriveOverallReadiness,
  type PilotDomainReadinessSnapshot,
} from "../pilotReadinessCore";
import type {
  ClinicalReadinessState,
  ConsentDocumentReadinessState,
  FinancialReadinessState,
  ImageReadinessState,
  AppointmentReadinessState,
  OperationalReadinessState,
  PathologyReadinessState,
  PatientReadinessState,
} from "../pilotControlContracts";
import type {
  OverallReadinessResult,
  PilotPatientReadiness,
  ReadinessDimensionResult,
  ReadinessSignalResult,
} from "./readinessTypes";
import { READINESS_EVALUATION_VERSION } from "./readinessTypes";

function mapClinical(d: ReadinessDimensionResult): ClinicalReadinessState {
  switch (d.state) {
    case "blocked":
      return "blocked";
    case "ready":
      return "ready";
    case "awaiting_review":
      return "awaiting_review";
    case "not_applicable":
      return "not_applicable";
    case "attention_required":
    case "in_progress":
      return "in_progress";
    default:
      return "not_started";
  }
}

function mapFinancial(
  d: ReadinessDimensionResult,
  signals: ReadinessSignalResult[]
): FinancialReadinessState {
  if (d.state === "blocked") {
    if (signals.some((s) => s.key === "financial.reconciliation_exception" && s.status === "failed")) {
      return "reconciliation_required";
    }
    return "blocked";
  }
  if (d.state === "ready") return "cleared";
  if (d.state === "not_applicable") return "not_applicable";
  if (signals.some((s) => s.key === "financial.payment_plan" && s.status === "satisfied")) {
    return "payment_plan_active";
  }
  if (signals.some((s) => s.key === "financial.deposit_verified" && s.status === "pending")) {
    return "deposit_pending";
  }
  if (signals.some((s) => s.key === "financial.accepted_quote" && s.status === "pending")) {
    return "quote_pending";
  }
  if (d.state === "not_started") return "not_started";
  return "deposit_pending";
}

function mapPatient(d: ReadinessDimensionResult): PatientReadinessState {
  switch (d.state) {
    case "blocked":
      return "blocked";
    case "ready":
      return "ready";
    case "attention_required":
      return "attention_required";
    case "not_applicable":
      return "not_applicable";
    case "in_progress":
    case "awaiting_review":
      return "in_progress";
    default:
      return "not_started";
  }
}

function mapOperational(d: ReadinessDimensionResult): OperationalReadinessState {
  switch (d.state) {
    case "blocked":
      return "blocked";
    case "ready":
      return "ready";
    case "attention_required":
      return "attention_required";
    case "not_applicable":
      return "not_applicable";
    case "in_progress":
    case "awaiting_review":
      return "in_progress";
    default:
      return "not_started";
  }
}

function mapConsent(signals: ReadinessSignalResult[]): ConsentDocumentReadinessState {
  const s = signals.find((x) => x.key === "patient.mandatory_consent");
  if (!s || s.requirement === "not_applicable" || s.status === "not_applicable") {
    return "not_applicable";
  }
  if (s.status === "unknown") return "unknown";
  if (s.status === "satisfied") return "ready";
  if (s.status === "missing" || s.status === "failed") return "blocked";
  if (s.status === "pending") return "in_progress";
  return "not_started";
}

function mapPathology(signals: ReadinessSignalResult[]): PathologyReadinessState {
  const req = signals.find((x) => x.key === "clinical.pathology_requirement");
  if (req?.status === "not_applicable" || req?.requirement === "not_applicable") {
    return "not_applicable";
  }
  const clearance = signals.find((x) => x.key === "clinical.pathology_clearance");
  const review = signals.find((x) => x.key === "clinical.pathology_review");
  const receipt = signals.find((x) => x.key === "clinical.pathology_receipt");
  if (clearance?.status === "satisfied") return "cleared";
  if (review?.status === "review_required") return "awaiting_review";
  if (receipt?.status === "satisfied") return "received";
  if (receipt?.status === "pending") return "requested";
  if (req?.status === "unknown" || clearance?.status === "unknown") return "unknown";
  if (clearance?.status === "failed" || receipt?.status === "missing") return "blocked";
  if (req?.status === "satisfied") return "requested";
  return "not_started";
}

function mapImages(signals: ReadinessSignalResult[]): ImageReadinessState {
  const s = signals.find((x) => x.key === "patient.required_image_role");
  if (!s || s.status === "not_applicable") return "not_applicable";
  if (s.status === "satisfied") return "ready";
  if (s.status === "missing") return "blocked";
  if (s.status === "unknown") return "unknown";
  return "in_progress";
}

function mapAppointment(signals: ReadinessSignalResult[]): AppointmentReadinessState {
  const conf = signals.find((x) => x.key === "operational.appointment_confirmed");
  const exists = signals.find((x) => x.key === "operational.appointment_exists");
  if (conf?.status === "satisfied") return "confirmed";
  if (conf?.status === "not_applicable" || exists?.status === "not_applicable") {
    return "not_applicable";
  }
  if (conf?.status === "pending") return "scheduled";
  if (conf?.status === "missing" || exists?.status === "missing") return "blocked";
  if (conf?.status === "unknown") return "unknown";
  if (exists?.status === "satisfied") return "scheduled";
  return "not_started";
}

export function composeOverallFromDimensions(args: {
  clinical: ReadinessDimensionResult;
  financial: ReadinessDimensionResult;
  patient: ReadinessDimensionResult;
  operational: ReadinessDimensionResult;
  technical: ReadinessDimensionResult;
  identityIntegrityBlocked: boolean;
  technicalAttention: boolean;
  enrolmentCompleted: boolean;
  evaluatedAt: string;
}): OverallReadinessResult {
  const allSignals = [
    ...args.clinical.mandatorySignals,
    ...args.clinical.optionalSignals,
    ...args.financial.mandatorySignals,
    ...args.financial.optionalSignals,
    ...args.patient.mandatorySignals,
    ...args.patient.optionalSignals,
    ...args.operational.mandatorySignals,
    ...args.operational.optionalSignals,
    ...args.technical.mandatorySignals,
    ...args.technical.optionalSignals,
  ];

  const consent = mapConsent(allSignals);
  const pathology = mapPathology(allSignals);
  const mandatoryConsentGap =
    consent === "blocked" || consent === "unknown";
  const clinicalBlockerPresent =
    args.clinical.state === "blocked" ||
    allSignals.some(
      (s) =>
        s.key.startsWith("clinical.") &&
        s.blocking &&
        s.status !== "satisfied" &&
        s.status !== "not_applicable"
    );
  const mandatoryFinancialGateUnmet =
    args.financial.state === "blocked" ||
    allSignals.some(
      (s) =>
        (s.key === "financial.clearance" ||
          s.key === "financial.deposit_verified" ||
          s.key === "financial.wrong_patient_payment") &&
        s.blocking &&
        s.status !== "satisfied" &&
        s.status !== "not_applicable"
    );

  const snapshot: PilotDomainReadinessSnapshot = {
    clinical: mapClinical(args.clinical),
    financial: mapFinancial(args.financial, allSignals),
    operational: mapOperational(args.operational),
    patient: mapPatient(args.patient),
    consent,
    documents: consent === "blocked" ? "blocked" : consent === "ready" ? "ready" : "not_applicable",
    pathology,
    images: mapImages(allSignals),
    appointment: mapAppointment(allSignals),
    identityIntegrityBlocked: args.identityIntegrityBlocked,
    technicalAttention: args.technicalAttention,
    mandatoryConsentGap,
    mandatoryFinancialGateUnmet,
    clinicalBlockerPresent,
    enrolmentCompleted: args.enrolmentCompleted,
    provenance: allSignals.flatMap((s) =>
      s.provenance.map((p) => {
        const signalUnknown =
          p.observedValueClass === "unknown" || s.status === "unknown";
        // Only mandatory (or blocking conditional) unknowns fail closed.
        const mandatoryUnknown =
          signalUnknown &&
          (s.requirement === "mandatory" ||
            (s.requirement === "conditional" && s.blocking));
        return {
          sourceModule: p.sourceSystem,
          sourceRecordType: p.sourceTable ?? p.sourceView ?? null,
          sourceRecordId: p.sourceRecordId ?? null,
          observedAt: args.evaluatedAt,
          unknown: mandatoryUnknown,
        };
      })
    ),
  };

  const derived = deriveOverallReadiness(snapshot);
  return {
    state: derived.overall,
    reasons: derived.reasons,
    failClosed: derived.failClosed,
    evaluatedAt: args.evaluatedAt,
    evaluationVersion: READINESS_EVALUATION_VERSION,
  };
}

export function sortBlockersStable<T extends { id: string; severity: string }>(items: T[]): T[] {
  const sev = { critical: 0, high: 1, attention: 2, info: 3 } as Record<string, number>;
  return [...items].sort((a, b) => {
    const ds = (sev[a.severity] ?? 9) - (sev[b.severity] ?? 9);
    if (ds !== 0) return ds;
    return a.id.localeCompare(b.id);
  });
}

export type ComposePatientReadinessArgs = {
  programmeId: string;
  enrolmentId: string;
  tenantId: string;
  patientId: string;
  journeyStage: PilotPatientReadiness["journeyStage"];
  clinical: ReadinessDimensionResult;
  financial: ReadinessDimensionResult;
  patient: ReadinessDimensionResult;
  operational: ReadinessDimensionResult;
  technical: ReadinessDimensionResult;
  identityIntegrityBlocked: boolean;
  technicalAttention: boolean;
  enrolmentCompleted: boolean;
  evaluatedAt: string;
};

export function assemblePilotPatientReadiness(
  args: ComposePatientReadinessArgs
): PilotPatientReadiness {
  const overall = composeOverallFromDimensions(args);
  const blockers = sortBlockersStable([
    ...args.clinical.blockers,
    ...args.financial.blockers,
    ...args.patient.blockers,
    ...args.operational.blockers,
    ...args.technical.blockers,
  ]);
  const warnings = [
    ...args.clinical.warnings,
    ...args.financial.warnings,
    ...args.patient.warnings,
    ...args.operational.warnings,
    ...args.technical.warnings,
  ].sort((a, b) => a.code.localeCompare(b.code));

  return {
    programmeId: args.programmeId,
    enrolmentId: args.enrolmentId,
    tenantId: args.tenantId,
    patientId: args.patientId,
    clinical: args.clinical,
    financial: args.financial,
    patient: args.patient,
    operational: args.operational,
    technical: args.technical,
    overall,
    blockers,
    warnings,
    evaluatedAt: args.evaluatedAt,
    evaluationVersion: READINESS_EVALUATION_VERSION,
    journeyStage: args.journeyStage,
    identityIntegrityBlocked: args.identityIntegrityBlocked,
  };
}
