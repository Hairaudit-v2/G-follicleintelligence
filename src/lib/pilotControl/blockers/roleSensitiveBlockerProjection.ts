/**
 * Role-sensitive blocker projections (1A.3).
 * Prepared for future UI/API; pure redaction only.
 */

import {
  pilotControlRoleHasScope,
  type PilotControlRoleKey,
} from "../pilotControlContracts";
import type { PilotBlockerRecord } from "./blockerTypes";
import type { ReadinessProvenance } from "../readiness/readinessTypes";

function redactProvenance(list: ReadinessProvenance[], keepDetail: boolean): ReadinessProvenance[] {
  if (keepDetail) return list;
  return list.map((p) => ({
    sourceSystem: p.sourceSystem,
    observedValueClass: p.observedValueClass,
    resolverVersion: p.resolverVersion,
  }));
}

export type ProjectedPilotBlocker = Omit<
  PilotBlockerRecord,
  "provenance" | "summary" | "patientSafeSummary"
> & {
  provenance: ReadinessProvenance[];
  summary: string;
  patientSafeSummary?: string;
  /** True when clinical/financial detail was redacted. */
  redacted: boolean;
};

function roleCanSeeClinical(role: PilotControlRoleKey): "full" | "summary" | "none" {
  if (pilotControlRoleHasScope(role, "detail_clinical_full")) return "full";
  if (pilotControlRoleHasScope(role, "detail_clinical_summary")) return "summary";
  return "none";
}

function roleCanSeeFinancial(role: PilotControlRoleKey): "full" | "summary" | "none" {
  if (pilotControlRoleHasScope(role, "detail_financial_full")) return "full";
  if (pilotControlRoleHasScope(role, "detail_financial_summary")) return "summary";
  return "none";
}

function roleCanSeeTechnical(role: PilotControlRoleKey): boolean {
  return pilotControlRoleHasScope(role, "detail_technical");
}

/**
 * Project a blocker for a staff role. Critical identity/privacy remain internal-only
 * (no patientSafeSummary). Reception never receives detailed clinical provenance.
 */
export function projectBlockerForRole(
  blocker: PilotBlockerRecord,
  role: PilotControlRoleKey
): ProjectedPilotBlocker {
  const clinical = roleCanSeeClinical(role);
  const financial = roleCanSeeFinancial(role);
  const technical = roleCanSeeTechnical(role);

  let redacted = false;
  let summary = blocker.summary;
  let provenance = blocker.provenance;
  let patientSafeSummary = blocker.patientSafeSummary;
  let sourceRecordId = blocker.sourceRecordId;

  // Critical identity / privacy: never emit patient-safe wording
  if (blocker.criticalIntegrity || blocker.severity === "critical") {
    patientSafeSummary = undefined;
  }

  if (blocker.dimension === "clinical" || blocker.category === "pathology" || blocker.category === "clinical_review") {
    if (clinical === "none") {
      redacted = true;
      summary = blocker.patientSafeSummary ?? "A clinic review is required.";
      provenance = [];
      sourceRecordId = undefined;
      patientSafeSummary = blocker.patientSafeSummary ?? summary;
    } else if (clinical === "summary") {
      redacted = true;
      provenance = redactProvenance(provenance, false);
      sourceRecordId = undefined;
    }
  }

  if (blocker.dimension === "financial" || blocker.category === "financial" || blocker.category === "payment_reconciliation") {
    if (financial === "none") {
      redacted = true;
      summary = blocker.patientSafeSummary ?? "A payment step requires clinic attention.";
      provenance = [];
      sourceRecordId = undefined;
    } else if (financial === "summary") {
      provenance = redactProvenance(provenance, false);
      if (role === "reception") {
        sourceRecordId = undefined;
      }
    }
  }

  // Technical role: hide clinical/financial content
  if (role === "technical") {
    if (blocker.dimension === "clinical" || blocker.dimension === "financial" || blocker.dimension === "patient") {
      if (blocker.dimension !== "technical" && blocker.dimension !== "identity") {
        redacted = true;
        summary = "Operational blocker (clinical/financial detail withheld).";
        provenance = redactProvenance(provenance, false);
        sourceRecordId = undefined;
        patientSafeSummary = undefined;
      }
    }
  }

  // Finance: hide unnecessary clinical
  if (role === "finance" && (blocker.dimension === "clinical" || blocker.category === "pathology")) {
    redacted = true;
    summary = blocker.patientSafeSummary ?? "Clinical review required (details withheld).";
    provenance = [];
    sourceRecordId = undefined;
  }

  // Reception: no detailed clinical provenance
  if (role === "reception" && (blocker.dimension === "clinical" || blocker.category === "pathology")) {
    redacted = true;
    provenance = [];
    sourceRecordId = undefined;
    summary = blocker.patientSafeSummary ?? "Your clinic needs to complete a review.";
  }

  if (!technical && blocker.dimension === "technical" && role !== "director" && role !== "administrator" && role !== "clinic_manager") {
    provenance = redactProvenance(provenance, false);
  }

  return {
    ...blocker,
    summary,
    patientSafeSummary,
    sourceRecordId,
    provenance,
    redacted,
  };
}

export function projectBlockersForRole(
  blockers: readonly PilotBlockerRecord[],
  role: PilotControlRoleKey
): ProjectedPilotBlocker[] {
  return blockers.map((b) => projectBlockerForRole(b, role));
}
