/**
 * Role-sensitive readiness projection (pure). Enforced at API layer in 1A.4;
 * engine exposes projection for tests and future API use.
 */

import {
  pilotControlRoleHasScope,
  type PilotControlRoleKey,
} from "../pilotControlContracts";
import type {
  PilotPatientReadiness,
  ReadinessDimensionResult,
  ReadinessProvenance,
  ReadinessSignalResult,
} from "./readinessTypes";

function redactProvenance(
  list: ReadinessProvenance[],
  keepDetail: boolean
): ReadinessProvenance[] {
  if (keepDetail) return list;
  return list.map((p) => ({
    sourceSystem: p.sourceSystem,
    observedValueClass: p.observedValueClass,
    resolverVersion: p.resolverVersion,
    // Drop record ids / fields for summary-only roles
  }));
}

function redactSignal(
  s: ReadinessSignalResult,
  keepDetail: boolean
): ReadinessSignalResult {
  if (keepDetail) return s;
  return {
    ...s,
    sourceRecordId: undefined,
    provenance: redactProvenance(s.provenance, false),
    patientSafeSummary: s.patientSafeSummary,
  };
}

function projectDimension(
  d: ReadinessDimensionResult,
  keepDetail: boolean
): ReadinessDimensionResult {
  return {
    ...d,
    mandatorySignals: d.mandatorySignals.map((s) => redactSignal(s, keepDetail)),
    optionalSignals: d.optionalSignals.map((s) => redactSignal(s, keepDetail)),
    provenance: redactProvenance(d.provenance, keepDetail),
    blockers: keepDetail
      ? d.blockers
      : d.blockers.map((b) => ({
          ...b,
          sourceRecordId: null,
          patientSafeSummary: b.patientSafeSummary,
        })),
  };
}

/**
 * Finance-only users cannot receive detailed clinical provenance.
 * Reception users receive permitted readiness summaries only (no clinical full).
 */
export function projectReadinessForRole(
  readiness: PilotPatientReadiness,
  role: PilotControlRoleKey
): PilotPatientReadiness {
  const clinicalDetail = pilotControlRoleHasScope(role, "detail_clinical_full");
  const clinicalSummary = pilotControlRoleHasScope(role, "detail_clinical_summary");
  const financialDetail = pilotControlRoleHasScope(role, "detail_financial_full");
  const financialSummary = pilotControlRoleHasScope(role, "detail_financial_summary");

  const keepClinical = clinicalDetail;
  const keepFinancial = financialDetail;

  // Reception: no clinical detail; financial summary only.
  const clinicalAllowed = clinicalDetail || clinicalSummary;
  const financialAllowed = financialDetail || financialSummary;

  return {
    ...readiness,
    clinical: clinicalAllowed
      ? projectDimension(readiness.clinical, keepClinical)
      : {
          ...projectDimension(readiness.clinical, false),
          mandatorySignals: readiness.clinical.mandatorySignals.map((s) => ({
            key: s.key,
            label: s.label,
            sourceSystem: s.sourceSystem,
            requirement: s.requirement,
            status: s.status,
            blocking: s.blocking,
            reasonCode: s.reasonCode,
            patientSafeSummary: s.patientSafeSummary ?? s.label,
            provenance: [],
          })),
          optionalSignals: [],
          provenance: [],
          blockers: readiness.clinical.blockers.map((b) => ({
            ...b,
            sourceRecordId: null,
            patientSafeSummary: b.patientSafeSummary,
          })),
        },
    financial: financialAllowed
      ? projectDimension(readiness.financial, keepFinancial)
      : {
          ...readiness.financial,
          state: readiness.financial.state,
          mandatorySignals: [],
          optionalSignals: [],
          provenance: [],
          blockers: readiness.financial.blockers.map((b) => ({
            ...b,
            sourceRecordId: null,
          })),
          warnings: readiness.financial.warnings,
        },
  };
}
