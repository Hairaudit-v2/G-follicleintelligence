/**
 * Identity integrity gate — evaluated before all other dimensions (pure).
 */

import { buildSignal, blockerFromSignal } from "../signalHelpers";
import type { PilotBlocker, ReadinessSignalResult } from "../readinessTypes";
import type { IdentitySourceBag } from "../readinessSourceBag";

export type IdentityAdapterResult = {
  signals: ReadinessSignalResult[];
  blockers: PilotBlocker[];
  identityIntegrityBlocked: boolean;
  criticalIntegrity: boolean;
};

export function resolveIdentitySignals(args: {
  bag: IdentitySourceBag;
  enrolmentPatientId: string;
  enrolmentTenantId: string;
  evaluatedAt: string;
}): IdentityAdapterResult {
  const { bag, enrolmentPatientId, enrolmentTenantId, evaluatedAt } = args;
  const signals: ReadinessSignalResult[] = [];
  const blockers: PilotBlocker[] = [];

  const patientExists = buildSignal({
    key: "identity.patient_exists",
    label: "Canonical patient exists",
    sourceSystem: "foundation_identity",
    requirement: "mandatory",
    status: bag.patientFound ? "satisfied" : "missing",
    reasonCode: bag.patientFound ? "patient_found" : "patient_not_found",
    observedValueClass: bag.patientFound ? "present" : "absent",
    sourceTable: "fi_patients",
    sourceRecordId: bag.patientId ?? undefined,
    sourceField: "id",
    patientSafeSummary: bag.patientFound
      ? "Canonical patient record resolved"
      : "Canonical patient record not found",
  });
  signals.push(patientExists);

  const tenantOk =
    bag.patientFound &&
    bag.patientTenantId != null &&
    bag.patientTenantId === enrolmentTenantId &&
    !bag.crossTenantMapping;
  const tenantMatch = buildSignal({
    key: "identity.tenant_match",
    label: "Patient belongs to enrolment tenant",
    sourceSystem: "foundation_identity",
    requirement: "mandatory",
    status: !bag.patientFound
      ? "unknown"
      : tenantOk
        ? "satisfied"
        : "failed",
    reasonCode: tenantOk
      ? "tenant_match"
      : bag.crossTenantMapping
        ? "cross_tenant_mapping"
        : "tenant_mismatch",
    observedValueClass: !bag.patientFound ? "unknown" : tenantOk ? "present" : "failed",
    sourceTable: "fi_patients",
    sourceField: "tenant_id",
    sourceRecordId: bag.patientId ?? undefined,
    severity: bag.crossTenantMapping || (!tenantOk && bag.patientFound) ? "critical" : "high",
    blocking: true,
    patientSafeSummary: tenantOk
      ? "Patient tenant matches enrolment"
      : "Patient tenant does not match enrolment — fail closed",
  });
  signals.push(tenantMatch);

  const enrolmentMatch =
    bag.patientId != null &&
    bag.patientId === enrolmentPatientId &&
    !bag.sourcePatientIdMismatch;
  const enrolmentPatient = buildSignal({
    key: "identity.enrolment_patient_match",
    label: "Enrolment references canonical patient",
    sourceSystem: "pilot_enrolment",
    requirement: "mandatory",
    status: enrolmentMatch ? "satisfied" : "failed",
    reasonCode: enrolmentMatch ? "enrolment_patient_match" : "enrolment_patient_mismatch",
    observedValueClass: enrolmentMatch ? "present" : "failed",
    sourceTable: "fi_pilot_enrolments",
    sourceField: "patient_id",
    severity: bag.sourcePatientIdMismatch ? "critical" : "high",
    blocking: true,
    patientSafeSummary: enrolmentMatch
      ? "Enrolment patient id matches canonical patient"
      : "Enrolment / source patient id mismatch",
  });
  signals.push(enrolmentPatient);

  const uniqueOk = bag.patientFound && !bag.ambiguousPatient;
  const unique = buildSignal({
    key: "identity.unique_patient",
    label: "Patient identity is unique",
    sourceSystem: "foundation_identity",
    requirement: "mandatory",
    status: !bag.patientFound ? "unknown" : uniqueOk ? "satisfied" : "failed",
    reasonCode: uniqueOk ? "unique_patient" : "ambiguous_patient",
    observedValueClass: !bag.patientFound ? "unknown" : uniqueOk ? "present" : "failed",
    sourceView: "v_fi_patient_resolution",
    severity: "high",
    blocking: true,
    patientSafeSummary: uniqueOk
      ? "Patient resolves uniquely"
      : "Ambiguous patient identity — fail closed",
  });
  signals.push(unique);

  const appUnique =
    bag.appAuthUserId == null || bag.appLinkagePatientCount <= 1;
  const appLinkage = buildSignal({
    key: "identity.app_linkage_unique",
    label: "App identity linkage unique",
    sourceSystem: "patient_app_gateway",
    requirement: bag.appAuthUserId ? "mandatory" : "not_applicable",
    status:
      bag.appAuthUserId == null
        ? "not_applicable"
        : appUnique
          ? "satisfied"
          : "failed",
    reasonCode:
      bag.appAuthUserId == null
        ? "no_app_linkage"
        : appUnique
          ? "app_linkage_unique"
          : "app_linkage_ambiguous",
    observedValueClass:
      bag.appAuthUserId == null ? "not_applicable" : appUnique ? "present" : "failed",
    sourceTable: "fi_patients",
    sourceField: "portal_auth_user_id",
    severity: appUnique ? undefined : "critical",
    blocking: bag.appAuthUserId != null && !appUnique,
    patientSafeSummary: appUnique
      ? "App identity linkage is unique or absent"
      : "Multiple patients share one app identity",
  });
  signals.push(appLinkage);

  const noCross = buildSignal({
    key: "identity.no_cross_tenant_mapping",
    label: "No cross-tenant mapping",
    sourceSystem: "foundation_identity",
    requirement: "mandatory",
    status: bag.crossTenantMapping ? "failed" : "satisfied",
    reasonCode: bag.crossTenantMapping ? "cross_tenant_detected" : "no_cross_tenant",
    observedValueClass: bag.crossTenantMapping ? "failed" : "present",
    sourceView: "v_fi_patient_resolution",
    severity: bag.crossTenantMapping ? "critical" : undefined,
    blocking: bag.crossTenantMapping,
    patientSafeSummary: bag.crossTenantMapping
      ? "Cross-tenant identity mapping detected"
      : "No cross-tenant mapping detected",
  });
  signals.push(noCross);

  const dupOk = bag.activeEnrolmentCountForProgrammePatient <= 1;
  const dupEnrolment = buildSignal({
    key: "identity.no_duplicate_active_enrolment",
    label: "No duplicate active programme enrolment",
    sourceSystem: "pilot_enrolment",
    requirement: "mandatory",
    status: dupOk ? "satisfied" : "failed",
    reasonCode: dupOk ? "single_enrolment" : "duplicate_active_enrolment",
    observedValueClass: dupOk ? "present" : "failed",
    sourceTable: "fi_pilot_enrolments",
    severity: dupOk ? undefined : "high",
    blocking: !dupOk,
    patientSafeSummary: dupOk
      ? "Single active enrolment for programme"
      : "Duplicate active enrolments for programme and patient",
  });
  signals.push(dupEnrolment);

  if (bag.crmLeadPatientIdConflict) {
    const crm = buildSignal({
      key: "identity.crm_lead_conflict",
      label: "CRM / lead linkage conflict",
      sourceSystem: "crm_quotes",
      requirement: "mandatory",
      status: "failed",
      reasonCode: "crm_lead_patient_conflict",
      observedValueClass: "failed",
      severity: "high",
      blocking: true,
      patientSafeSummary: "CRM lead linkage conflicts with canonical patient",
    });
    signals.push(crm);
  }

  let criticalIntegrity = false;
  let identityIntegrityBlocked = false;

  for (const s of signals) {
    if (
      s.status === "failed" ||
      s.status === "missing" ||
      (s.requirement === "mandatory" && s.status === "unknown")
    ) {
      identityIntegrityBlocked = true;
      const critical =
        s.severity === "critical" ||
        s.key === "identity.no_cross_tenant_mapping" ||
        s.key === "identity.tenant_match" ||
        s.key === "identity.app_linkage_unique" ||
        s.reasonCode.includes("cross_tenant") ||
        s.reasonCode.includes("mismatch");
      if (critical) criticalIntegrity = true;
      blockers.push(
        blockerFromSignal({
          signal: s,
          category: "identity",
          severity: critical ? "critical" : "high",
          owner: "platform",
          recommendedNextAction:
            "Pause pilot observation for this patient and resolve identity integrity",
          criticalIntegrity: critical,
          evaluatedAt,
        })
      );
    }
  }

  return { signals, blockers, identityIntegrityBlocked, criticalIntegrity };
}
